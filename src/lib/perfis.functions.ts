// Server functions do módulo Perfis.
// - createInvite/revokeInvite/updateMemberModules/removeMember: só o admin.
// - acceptInvite: chamado pelo convidado já autenticado, valida o token,
//   confere o e-mail e cria o vínculo workspace_members.
//
// Convite é entregue por e-mail via Supabase Admin (inviteUserByEmail). Se o
// usuário já existe, a função devolve o link para o admin copiar/enviar à mão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODULE_KEYS, type ModuleKey } from "@/lib/perfis";

const moduleEnum = z.enum(MODULE_KEYS);

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((v) => v.toLowerCase()),
  modules: z.array(moduleEnum).min(1).max(MODULE_KEYS.length),
  origin: z.string().url().max(300),
});

function genToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = genToken();

    const { data: inv, error: invErr } = await supabase
      .from("workspace_invitations")
      .insert({
        owner_id: userId,
        email: data.email,
        modules: data.modules,
        token,
        status: "pending",
      })
      .select("id, token, email, modules, expires_at")
      .single();
    if (invErr || !inv) throw new Error(invErr?.message ?? "Falha ao criar convite");

    const acceptUrl = `${data.origin.replace(/\/$/, "")}/convite?token=${token}`;

    // Tenta enviar o e-mail via Supabase Admin. Se o usuário já existir,
    // devolve o link para o admin compartilhar manualmente.
    let emailSent = false;
    let shareLink = acceptUrl;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: acceptUrl,
        data: { invite_token: token, invited_by: userId },
      });
      if (!inviteErr) {
        emailSent = true;
      } else if (/already/i.test(inviteErr.message)) {
        // Já tem conta — gera magic link e devolve para o admin enviar.
        const { data: link } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: data.email,
          options: { redirectTo: acceptUrl },
        });
        if (link?.properties?.action_link) shareLink = link.properties.action_link;
      }
    } catch (e) {
      // Não derruba o convite — o admin pode usar shareLink.
      console.error("[createInvite] email send failed", e);
    }

    return { invite: inv, acceptUrl, shareLink, emailSent };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(20).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = (claims.email as string | undefined)?.toLowerCase();

    // Lê o convite usando service role (token só é válido se a pessoa o conhece)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("workspace_invitations")
      .select("id, owner_id, email, modules, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !invite) throw new Error("Convite inválido.");
    if (invite.status !== "pending") throw new Error("Convite já usado ou cancelado.");
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("workspace_invitations")
        .update({ status: "expired" })
        .eq("id", invite.id);
      throw new Error("Convite expirado.");
    }
    if (userEmail && invite.email.toLowerCase() !== userEmail) {
      throw new Error(
        "Este convite foi enviado para outro e-mail. Faça login com a conta correta.",
      );
    }
    if (invite.owner_id === userId) {
      throw new Error("Você é o próprio admin deste workspace — convide outra pessoa.");
    }

    // Cria/atualiza vínculo. UNIQUE(member_id) impede vínculos cruzados.
    const { error: linkErr } = await supabaseAdmin
      .from("workspace_members")
      .upsert(
        { owner_id: invite.owner_id, member_id: userId, modules: invite.modules },
        { onConflict: "member_id" },
      );
    if (linkErr) throw new Error(linkErr.message);

    // Marca convite como aceito + rebaixa user para member
    await supabaseAdmin
      .from("workspace_invitations")
      .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "member" }, { onConflict: "user_id,role" });

    // Seta assigned_facet no profile baseado nos módulos do convite
    const modules = invite.modules as string[];
    let assignedFacet: string | null = null;
    if (modules.includes("kuanyin")) assignedFacet = "kuanyin";
    else if (modules.includes("kharis")) assignedFacet = "kharis";
    else assignedFacet = "kaline";

    await supabaseAdmin
      .from("profiles")
      .update({ role: "user", assigned_facet: assignedFacet })
      .eq("id", userId);

    return { owner_id: invite.owner_id, modules: invite.modules };
  });

export const updateMemberModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        memberId: z.string().uuid(),
        modules: z.array(moduleEnum),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_members")
      .update({ modules: data.modules })
      .eq("owner_id", context.userId)
      .eq("member_id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_members")
      .delete()
      .eq("owner_id", context.userId)
      .eq("member_id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type InviteWithLink = Awaited<ReturnType<typeof createInvite>>;
export type ModuleSelection = ModuleKey[];

// ─── Contexto Inicial ─────────────────────────────────────────────

const initialContextSchema = z.object({
  memberId: z.string().uuid(),
  treatment_name: z.string().max(200).optional(),
  main_goal: z.string().max(1000).optional(),
  tone: z.string().max(500).optional(),
  important_context: z.string().max(2000).optional(),
  limits_and_cautions: z.string().max(2000).optional(),
  response_preferences: z.string().max(1000).optional(),
  admin_notes: z.string().max(2000).optional(),
  initial_seeds: z.string().max(2000).optional(),
});

export const saveInitialContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => initialContextSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica se o usuário logado é admin do memberId
    const { data: member } = await supabase
      .from("workspace_members")
      .select("member_id")
      .eq("owner_id", userId)
      .eq("member_id", data.memberId)
      .maybeSingle();
    if (!member) throw new Error("Este perfil não pertence ao seu workspace.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profile_initial_contexts").upsert(
      {
        user_id: data.memberId,
        created_by: userId,
        treatment_name: data.treatment_name ?? null,
        main_goal: data.main_goal ?? null,
        tone: data.tone ?? null,
        important_context: data.important_context ?? null,
        limits_and_cautions: data.limits_and_cautions ?? null,
        response_preferences: data.response_preferences ?? null,
        admin_notes: data.admin_notes ?? null,
        initial_seeds: data.initial_seeds ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMemberInitialContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ctx } = await supabaseAdmin
      .from("profile_initial_contexts")
      .select("*")
      .eq("user_id", data.memberId)
      .maybeSingle();
    return ctx;
  });

// ─── Métricas do Admin ────────────────────────────────────────────

export type AdminMetrics = {
  activeProfiles: number;
  pendingInvites: number;
  messagesToday: number;
  messagesWeek: number;
  withoutContext: number;
  profilesByFacet: Record<string, number>;
};

export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Apenas admin pode ver métricas
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(`Falha ao verificar admin: ${roleError.message}`);
    if (!roleRow) return null;

    const [membersRes, invitesRes, msgsTodayRes, msgsWeekRes, memberRowsRes] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId),
      supabase
        .from("workspace_invitations")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("status", "pending"),
      supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("workspace_members").select("member_id").eq("owner_id", userId),
    ]);

    for (const [label, result] of Object.entries({
      members: membersRes,
      invites: invitesRes,
      messagesToday: msgsTodayRes,
      messagesWeek: msgsWeekRes,
      workspaceMembers: memberRowsRes,
    })) {
      if (result.error)
        throw new Error(`Falha ao carregar métricas (${label}): ${result.error.message}`);
    }

    const memberIds = (memberRowsRes.data ?? []).map((row) => row.member_id).filter(Boolean);
    let profileData: Array<Record<string, string | null>> = [];

    if (memberIds.length > 0) {
      const profilesByFacetRes = await supabase
        .from("profiles")
        .select("assigned_facet")
        .in("id", memberIds);
      if (profilesByFacetRes.error) {
        throw new Error(
          `Falha ao carregar métricas (profiles): ${profilesByFacetRes.error.message}`,
        );
      }
      profileData = (profilesByFacetRes.data ?? []) as unknown as Array<
        Record<string, string | null>
      >;
    }

    // Conta quem tem assigned_facet = null ou vazio
    let withoutContext = 0;
    const facetCount: Record<string, number> = {};
    for (const p of profileData) {
      const facet = p?.assigned_facet ?? "não atribuída";
      facetCount[facet] = (facetCount[facet] ?? 0) + 1;
      if (!p?.assigned_facet) withoutContext++;
    }

    return {
      activeProfiles: membersRes.count ?? 0,
      pendingInvites: invitesRes.count ?? 0,
      messagesToday: msgsTodayRes.count ?? 0,
      messagesWeek: msgsWeekRes.count ?? 0,
      withoutContext,
      profilesByFacet: facetCount,
    } satisfies AdminMetrics;
  });
