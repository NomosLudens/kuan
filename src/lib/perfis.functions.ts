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
import { makeObservabilityEvent } from "@/lib/observability/logger";

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

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function slugifyGuardianSeed(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return slug || "guardiao";
}

async function createKuanYinGuardianLink(params: {
  adminUserId: string;
  guardianUserId: string;
  email: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("kuanyin_guardians")
    .select("id, admin_user_id, metadata")
    .eq("user_id", params.guardianUserId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    const existingGuardian = existing as {
      id: string;
      admin_user_id: string | null;
      metadata: Record<string, unknown> | null;
    };
    const { error: updateError } = await supabaseAdmin
      .from("kuanyin_guardians")
      .update({
        ...(existingGuardian.admin_user_id ? {} : { admin_user_id: params.adminUserId }),
        metadata: {
          ...(existingGuardian.metadata ?? {}),
          linked_by_invite: true,
          linked_at: new Date().toISOString(),
        },
      } as never)
      .eq("id", existingGuardian.id);
    if (updateError) throw new Error(updateError.message);
    return;
  }

  const fallbackName = params.email.split("@")[0] || "Guardião";
  const { data: contextRow, error: contextError } = await supabaseAdmin
    .from("business_contexts")
    .insert({
      user_id: params.guardianUserId,
      nome: fallbackName,
      tipo: "",
      observacoes:
        "Contexto criado pelo aceite de convite Kuan-Yin. O Guardião deve substituir pelos dados reais do negócio em /kuan/config.",
    } as never)
    .select("id")
    .single();
  if (contextError || !contextRow) {
    throw new Error(contextError?.message ?? "Falha ao criar contexto do Guardião.");
  }

  const createdContextId = (contextRow as { id: string }).id;
  const cleanupCreatedContext = async () => {
    await supabaseAdmin.from("business_contexts").delete().eq("id", createdContextId);
  };
  const base = slugifyGuardianSeed(fallbackName);
  let publicSlug = base;
  for (let i = 0; i < 8; i += 1) {
    const { error: guardianError } = await supabaseAdmin.from("kuanyin_guardians").insert({
      user_id: params.guardianUserId,
      admin_user_id: params.adminUserId,
      business_context_id: createdContextId,
      public_slug: publicSlug,
      status: "draft",
      metadata: { linked_by_invite: true, linked_at: new Date().toISOString() },
    } as never);
    if (!guardianError) return;
    if (!/duplicate key|unique/i.test(guardianError.message)) {
      await cleanupCreatedContext();
      throw new Error(guardianError.message);
    }
    publicSlug = `${base}-${crypto.randomUUID().slice(0, 6)}`.slice(0, 80);
  }
  await cleanupCreatedContext();
  throw new Error("Não foi possível reservar um slug público para o Guardião.");
}

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
        email: normalizeEmail(data.email) || data.email,
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

// Helper to mask emails for wrong session state to prevent direct leakage (Tarea 3)
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// Observability logging helper (Tarea 8)
function logInviteEvent(params: {
  action:
    | "invite_viewed"
    | "invite_accept_blocked_no_session"
    | "invite_accept_blocked_wrong_email"
    | "invite_accept_blocked_expired"
    | "invite_accept_blocked_already_accepted"
    | "invite_accepted";
  level: "info" | "warn" | "error";
  message: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  const event = makeObservabilityEvent({
    traceId: crypto.randomUUID(),
    level: params.level,
    area: "auth",
    action: params.action,
    message: params.message,
    userId: params.userId,
    metadata: params.metadata,
  });
  const consoleMethod =
    event.level === "error" ? console.error : event.level === "warn" ? console.warn : console.info;
  consoleMethod("[observability]", event);
}

export const checkGuardianInvitation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(20).max(80) }).parse(data))
  .handler(async ({ data }) => {
    let userEmail: string | null = null;
    let userId: string | null = null;

    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest();
      const authHeader = request?.headers?.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        if (token && token.split(".").length === 3) {
          const { createClient } = await import("@supabase/supabase-js");
          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY =
            process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!;
          const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
          const { data: claimsData } = await supabase.auth.getClaims(token);
          if (claimsData?.claims) {
            userEmail = normalizeEmail(claimsData.claims.email as string | undefined);
            userId = claimsData.claims.sub ?? null;
          }
        }
      }
    } catch (e) {
      console.warn("[checkGuardianInvitation] Failed to extract auth from request headers:", e);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("workspace_invitations")
      .select("id, owner_id, email, modules, status, expires_at, accepted_by, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    const invitationHash = data.token.slice(0, 10) + "...";

    if (error || !invite) {
      logInviteEvent({
        action: "invite_accept_blocked_expired",
        level: "warn",
        message: "Attempted to view invalid invitation token.",
        userId: userId ?? undefined,
        metadata: { token_hash: invitationHash, result: "invalid_token" },
      });
      return { status: "invalid", message: "Convite inválido ou não encontrado." };
    }

    // Logging invite view
    logInviteEvent({
      action: "invite_viewed",
      level: "info",
      message: `Invitation ${invite.id} viewed.`,
      userId: userId ?? undefined,
      metadata: {
        invitation_id: invite.id,
        actor_user_id: userId ?? null,
        actor_email: userEmail ?? null,
        invited_email: invite.email,
        result: "viewed",
      },
    });

    // 1. Without session (Estado 1): Do not leak anything!
    if (!userId || !userEmail) {
      logInviteEvent({
        action: "invite_accept_blocked_no_session",
        level: "info",
        message: `Blocked view of invitation details for ${invite.id} due to missing session.`,
        metadata: {
          invitation_id: invite.id,
          invited_email: invite.email,
          result: "blocked_no_session",
        },
      });
      return { status: "auth_required" };
    }

    const invitedEmailNormalized = normalizeEmail(invite.email);

    // 2. Already accepted (Estado 4 & 5)
    if (invite.status === "accepted") {
      if (invite.accepted_by === userId) {
        // Correct business info can be shown
        const { data: business } = await supabaseAdmin
          .from("business_contexts")
          .select("nome")
          .eq("user_id", invite.owner_id)
          .limit(1)
          .maybeSingle();
        const businessName = business?.nome || "Kuan-Yin";

        return {
          status: "success",
          alreadyAcceptedByMe: true,
          invite: {
            id: invite.id,
            email: invite.email,
            status: invite.status,
            expires_at: invite.expires_at,
            accepted_by: invite.accepted_by,
            modules: invite.modules,
          },
          businessName,
        };
      } else {
        logInviteEvent({
          action: "invite_accept_blocked_already_accepted",
          level: "warn",
          message: `Blocked view of invitation ${invite.id} already accepted by another user.`,
          userId,
          metadata: {
            invitation_id: invite.id,
            actor_user_id: userId,
            actor_email: userEmail,
            invited_email: invite.email,
            result: "blocked_already_accepted",
          },
        });
        return { status: "already_accepted_by_another_user" };
      }
    }

    // 3. Expired or Revoked
    if (invite.status === "expired" || new Date(invite.expires_at).getTime() < Date.now()) {
      return { status: "expired" };
    }
    if (invite.status === "revoked" || invite.status === "canceled") {
      return { status: "revoked" };
    }

    // 4. Session with wrong email (Estado 2): Return masked email, do not leak business/context info!
    if (userEmail !== invitedEmailNormalized) {
      logInviteEvent({
        action: "invite_accept_blocked_wrong_email",
        level: "warn",
        message: `Blocked view of invitation ${invite.id} due to email mismatch.`,
        userId,
        metadata: {
          invitation_id: invite.id,
          actor_user_id: userId,
          actor_email: userEmail,
          invited_email: invite.email,
          result: "blocked_wrong_email",
        },
      });
      return {
        status: "wrong_email",
        userEmail,
        invitedEmailMasked: maskEmail(invite.email),
      };
    }

    // 5. Correct session (Estado 3): Return full details
    const { data: business } = await supabaseAdmin
      .from("business_contexts")
      .select("nome")
      .eq("user_id", invite.owner_id)
      .limit(1)
      .maybeSingle();
    const businessName = business?.nome || "Kuan-Yin";

    return {
      status: "success",
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        expires_at: invite.expires_at,
        accepted_by: invite.accepted_by,
        modules: invite.modules,
      },
      businessName,
    };
  });

export const acceptGuardianInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(20).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const userEmail = normalizeEmail(claims.email as string | undefined);

    if (!userEmail) {
      logInviteEvent({
        action: "invite_accept_blocked_no_session",
        level: "error",
        message: "Blocked accept attempt: authenticated user has no email claim.",
        userId,
        metadata: { result: "blocked_no_email_claim" },
      });
      return { error: "auth_required" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("workspace_invitations")
      .select("id, owner_id, email, modules, status, expires_at, accepted_by, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    if (error || !invite) {
      return { error: "invalid" };
    }

    const invitedEmailNormalized = normalizeEmail(invite.email);

    // Check if expired
    if (invite.status === "expired" || new Date(invite.expires_at).getTime() < Date.now()) {
      if (invite.status !== "expired") {
        await supabaseAdmin
          .from("workspace_invitations")
          .update({ status: "expired" })
          .eq("id", invite.id);
      }
      logInviteEvent({
        action: "invite_accept_blocked_expired",
        level: "warn",
        message: `Blocked accept of invitation ${invite.id} because it has expired.`,
        userId,
        metadata: {
          invitation_id: invite.id,
          actor_user_id: userId,
          actor_email: userEmail,
          invited_email: invite.email,
          result: "blocked_expired",
        },
      });
      return { error: "expired" };
    }

    // Check if revoked/canceled
    if (invite.status === "revoked" || invite.status === "canceled") {
      logInviteEvent({
        action: "invite_accept_blocked_expired",
        level: "warn",
        message: `Blocked accept of invitation ${invite.id} because it was revoked/canceled.`,
        userId,
        metadata: {
          invitation_id: invite.id,
          actor_user_id: userId,
          actor_email: userEmail,
          invited_email: invite.email,
          result: "blocked_revoked",
        },
      });
      return { error: "revoked" };
    }

    // Check if already accepted
    if (invite.status === "accepted") {
      if (invite.accepted_by === userId) {
        return { success: true, owner_id: invite.owner_id, modules: invite.modules };
      } else {
        logInviteEvent({
          action: "invite_accept_blocked_already_accepted",
          level: "warn",
          message: `Blocked accept of invitation ${invite.id} because it was already accepted by another user.`,
          userId,
          metadata: {
            invitation_id: invite.id,
            actor_user_id: userId,
            actor_email: userEmail,
            invited_email: invite.email,
            result: "blocked_already_accepted",
          },
        });
        return { error: "already_accepted_by_another_user" };
      }
    }

    // Email matching validation
    if (userEmail !== invitedEmailNormalized) {
      logInviteEvent({
        action: "invite_accept_blocked_wrong_email",
        level: "warn",
        message: `Blocked accept of invitation ${invite.id} due to email mismatch.`,
        userId,
        metadata: {
          invitation_id: invite.id,
          actor_user_id: userId,
          actor_email: userEmail,
          invited_email: invite.email,
          result: "blocked_wrong_email",
        },
      });
      return { error: "wrong_email", invitedEmail: invite.email };
    }

    if (invite.owner_id === userId) {
      return { error: "owner_cannot_accept" };
    }

    try {
      // 1. Create/update workspace_members link
      const { data: existingMember, error: existingMemberError } = await supabaseAdmin
        .from("workspace_members")
        .select("id")
        .eq("owner_id", invite.owner_id)
        .eq("member_id", userId)
        .limit(1)
        .maybeSingle();
      if (existingMemberError) throw new Error(existingMemberError.message);

      const memberPayload = {
        owner_id: invite.owner_id,
        member_id: userId,
        modules: invite.modules,
      } as never;

      const { error: linkErr } = existingMember
        ? await supabaseAdmin
            .from("workspace_members")
            .update(memberPayload)
            .eq("id", (existingMember as { id: string }).id)
        : await supabaseAdmin.from("workspace_members").insert(memberPayload);
      if (linkErr) throw new Error(linkErr.message);

      // 2. Reset admin roles to member
      const { error: roleDelErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (roleDelErr) throw new Error(roleDelErr.message);

      const { error: roleUpsertErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "member" }, { onConflict: "user_id,role" });
      if (roleUpsertErr) throw new Error(roleUpsertErr.message);

      // 3. Set assigned_facet in profile
      const modules = invite.modules as string[];
      let assignedFacet: string | null = null;
      if (modules.includes("kuanyin")) assignedFacet = "kuanyin";
      else if (modules.includes("kharis")) assignedFacet = "kharis";
      else assignedFacet = "kaline";

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ role: "user", assigned_facet: assignedFacet })
        .eq("id", userId);
      if (profileErr) throw new Error(profileErr.message);

      // 4. Create guardian link if kuanyin
      if (modules.includes("kuanyin")) {
        await createKuanYinGuardianLink({
          adminUserId: invite.owner_id,
          guardianUserId: userId,
          email: invite.email,
        });
      }

      // 5. Mark invitation as accepted (VERY LAST STEP!)
      const { error: inviteUpdateErr } = await supabaseAdmin
        .from("workspace_invitations")
        .update({
          status: "accepted",
          accepted_by: userId,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invite.id);
      if (inviteUpdateErr) throw new Error(inviteUpdateErr.message);
    } catch (dbErr) {
      console.error("[acceptGuardianInvitation] Atomic sequential transaction failed:", dbErr);
      return {
        error: "accept_failed",
        message: dbErr instanceof Error ? dbErr.message : "Erro ao aceitar convite.",
      };
    }

    logInviteEvent({
      action: "invite_accepted",
      level: "info",
      message: `Invitation ${invite.id} successfully accepted.`,
      userId,
      metadata: {
        invitation_id: invite.id,
        actor_user_id: userId,
        actor_email: userEmail,
        invited_email: invite.email,
        result: "accepted",
      },
    });

    return { success: true, owner_id: invite.owner_id, modules: invite.modules };
  });
