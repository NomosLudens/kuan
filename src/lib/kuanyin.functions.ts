// Server functions da faceta Kuan-Yin (camada comercial sobre Kaline).
// Escopadas por usuário via requireSupabaseAuth + RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ─── helpers ─────────────────────────────────────────────────────────────────

const JsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValue),
    z.record(z.string(), JsonValue),
  ]),
);

// ─── business_context + guardian public identity ─────────────────────────────

const PUBLIC_SLUG_RESERVED = new Set(["admin", "api", "auth", "portal", "kuan-yin", "g"]);

function slugifyGuardianName(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "guardiao";
}

function normalizePublicSlug(value: string, fallback: string): string {
  const slug = slugifyGuardianName(value || fallback);
  return PUBLIC_SLUG_RESERVED.has(slug) ? `${slug}-kuanyin` : slug;
}

async function ensureUniqueGuardianSlug(
  baseSlug: string,
  businessContextId: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data } = await supabaseAdmin
      .from("kuanyin_guardians")
      .select("id, business_context_id")
      .eq("public_slug", candidate)
      .maybeSingle();
    if (
      !data ||
      (data as { business_context_id: string }).business_context_id === businessContextId
    ) {
      return candidate;
    }
  }
  return `${baseSlug}-${businessContextId.slice(0, 8)}`;
}

async function getGuardianForContext(businessContextId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("kuanyin_guardians")
    .select("id, public_slug, status, business_context_id")
    .eq("business_context_id", businessContextId)
    .maybeSingle();
  return data as {
    id: string;
    public_slug: string;
    status: string;
    business_context_id: string;
  } | null;
}

async function getWorkspaceOwnerForUser(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("owner_id, modules")
    .eq("member_id", userId)
    .maybeSingle();
  const row = data as { owner_id: string; modules?: string[] } | null;
  if (!row?.owner_id) return null;
  return Array.isArray(row.modules) && row.modules.includes("kuanyin") ? row.owner_id : null;
}

function genGuardianInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const GuardianStatus = z.enum(["draft", "published", "suspended", "archived"]);

const BusinessContextInput = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().trim().max(120).nullable().optional(),
  servicos: z.array(JsonValue).optional(),
  precos: z.record(z.string(), JsonValue).optional(),
  tom_voz: z.string().trim().max(500).nullable().optional(),
  formas_pagamento: z.array(JsonValue).optional(),
  pix_chave: z.string().trim().max(200).nullable().optional(),
  regras_agenda: z.record(z.string(), JsonValue).optional(),
  limites_decisao: z.record(z.string(), JsonValue).optional(),
  regras_escalonamento: z.record(z.string(), JsonValue).optional(),
  observacoes: z.string().trim().max(4000).nullable().optional(),
  public_slug: z.string().trim().min(2).max(80).optional(),
});

export const getBusinessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("business_contexts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const guardian = await getGuardianForContext((data as { id: string }).id);
    return {
      ...(data as Record<string, unknown>),
      public_slug: guardian?.public_slug ?? slugifyGuardianName((data as { nome: string }).nome),
      public_status: guardian?.status ?? "draft",
    };
  });

export const upsertBusinessContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BusinessContextInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { public_slug: requestedSlug, ...businessData } = data;
    const payload = { ...businessData, user_id: userId } as never;
    const { data: row, error } = await supabase
      .from("business_contexts")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const businessRow = row as unknown as { id: string; nome: string };
    const adminUserId = await getWorkspaceOwnerForUser(userId);
    const baseSlug = normalizePublicSlug(requestedSlug ?? businessRow.nome, businessRow.nome);
    const existingGuardian = await getGuardianForContext(businessRow.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let guardian: unknown = null;
    let guardianError: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidateBase = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const publicSlug = await ensureUniqueGuardianSlug(candidateBase, businessRow.id);
      const { data: saved, error: saveError } = await supabaseAdmin
        .from("kuanyin_guardians")
        .upsert(
          {
            user_id: userId,
            admin_user_id: adminUserId,
            business_context_id: businessRow.id,
            public_slug: publicSlug,
            status: existingGuardian?.status ?? "draft",
          } as never,
          { onConflict: "business_context_id" },
        )
        .select("id, public_slug, status")
        .single();
      guardian = saved;
      guardianError = saveError as { message: string; code?: string } | null;
      if (!guardianError) break;
      if (guardianError.code !== "23505") break;
    }
    if (guardianError) throw new Error(guardianError.message);

    return {
      ...(row as Record<string, unknown>),
      public_slug: (guardian as { public_slug: string }).public_slug,
      public_status: (guardian as { status: string }).status,
    };
  });

export const listKuanYinGuardians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("kuanyin_guardians")
      .select(
        "id, user_id, admin_user_id, business_context_id, public_slug, status, metadata, created_at, updated_at, business_contexts(nome, tipo, updated_at)",
      )
      .or(`user_id.eq.${userId},admin_user_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      ...(row as Record<string, unknown>),
      is_owner: (row as { user_id: string }).user_id === userId,
    }));
  });

export const updateKuanYinGuardianStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: GuardianStatus }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: guardian, error: readError } = await supabaseAdmin
      .from("kuanyin_guardians")
      .select("id, user_id, admin_user_id, status, metadata")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const row = guardian as {
      id: string;
      user_id: string;
      admin_user_id: string | null;
      status: string;
      metadata: Record<string, unknown> | null;
    } | null;
    if (!row || (row.user_id !== userId && row.admin_user_id !== userId)) {
      throw new Error("forbidden");
    }
    const { data: updated, error } = await supabaseAdmin
      .from("kuanyin_guardians")
      .update({
        status: data.status,
        metadata: {
          ...(row.metadata ?? {}),
          last_status_change: {
            actor_user_id: userId,
            from: row.status,
            to: data.status,
            at: new Date().toISOString(),
          },
        },
      } as never)
      .eq("id", data.id)
      .select("id, public_slug, status")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const listKuanYinPublicConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: guardians, error: guardianError } = await supabaseAdmin
      .from("kuanyin_guardians")
      .select("id, public_slug, business_contexts(nome)")
      .or(`user_id.eq.${userId},admin_user_id.eq.${userId}`)
      .limit(500);
    if (guardianError) throw new Error(guardianError.message);
    const guardianRows = (guardians ?? []) as unknown as Array<{
      id: string;
      public_slug: string;
      business_contexts: { nome: string } | null;
    }>;
    const guardianIds = guardianRows.map((g) => g.id);
    if (guardianIds.length === 0) return [];

    const { data: threads, error } = await supabaseAdmin
      .from("kuanyin_public_chat_threads")
      .select("id, guardian_id, visitor_name, visitor_key, status, created_at, updated_at")
      .in("guardian_id", guardianIds)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const guardianById = new Map(guardianRows.map((g) => [g.id, g]));
    return (threads ?? []).map((thread) => {
      const row = thread as { guardian_id: string };
      const guardian = guardianById.get(row.guardian_id);
      return {
        ...(thread as Record<string, unknown>),
        guardian_slug: guardian?.public_slug ?? null,
        guardian_name: guardian?.business_contexts?.nome ?? null,
      };
    });
  });

export const getKuanYinPublicConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: thread, error: threadError } = await supabaseAdmin
      .from("kuanyin_public_chat_threads")
      .select("id, guardian_id, visitor_name, visitor_key, status, created_at, updated_at")
      .eq("id", data.threadId)
      .maybeSingle();
    if (threadError) throw new Error(threadError.message);
    if (!thread) throw new Error("Conversa não encontrada");
    const threadRow = thread as { guardian_id: string };
    const { data: guardian, error: guardianError } = await supabaseAdmin
      .from("kuanyin_guardians")
      .select("id, user_id, admin_user_id, public_slug, business_contexts(nome)")
      .eq("id", threadRow.guardian_id)
      .maybeSingle();
    if (guardianError) throw new Error(guardianError.message);
    const guardianRow = guardian as {
      id: string;
      user_id: string;
      admin_user_id: string | null;
      public_slug: string;
      business_contexts: { nome: string } | null;
    } | null;
    if (!guardianRow || (guardianRow.user_id !== userId && guardianRow.admin_user_id !== userId)) {
      throw new Error("forbidden");
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("kuanyin_public_chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (messagesError) throw new Error(messagesError.message);

    return {
      thread: {
        ...(thread as Record<string, unknown>),
        guardian_slug: guardianRow.public_slug,
        guardian_name: guardianRow.business_contexts?.nome ?? null,
      },
      messages: messages ?? [],
    };
  });

export const createKuanYinGuardianInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(255)
          .transform((v) => v.toLowerCase()),
        origin: z.string().url().max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = genGuardianInviteToken();
    const { data: inv, error } = await supabase
      .from("workspace_invitations")
      .insert({
        owner_id: userId,
        email: data.email,
        modules: ["kuanyin"],
        token,
        status: "pending",
      })
      .select("id, token, email, modules, expires_at")
      .single();
    if (error || !inv) throw new Error(error?.message ?? "Falha ao criar convite");

    const acceptUrl = `${data.origin.replace(/\/$/, "")}/convite?token=${token}`;
    let shareLink = acceptUrl;
    let emailSent = false;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: acceptUrl,
        data: { invite_token: token, invited_by: userId, module: "kuanyin" },
      });
      if (!inviteErr) {
        emailSent = true;
      } else if (/already/i.test(inviteErr.message)) {
        const { data: link } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: data.email,
          options: { redirectTo: acceptUrl },
        });
        if (link?.properties?.action_link) shareLink = link.properties.action_link;
      }
    } catch (e) {
      console.error("[createKuanYinGuardianInvite] email send failed", e);
    }

    return { invite: inv, acceptUrl, shareLink, emailSent };
  });

// ─── kuanyin_clients ─────────────────────────────────────────────────────────

const ClientInput = z.object({
  id: z.string().uuid().optional(),
  business_context_id: z.string().uuid().nullable().optional(),
  linked_user_id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(1).max(200),
  telefone: z.string().trim().max(40).nullable().optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  preferencias: z.record(z.string(), JsonValue).optional(),
  notas: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["prospect", "confirmed", "archived"]).optional(),
  metadata: z.record(z.string(), JsonValue).optional(),
});

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClientInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id: _ignore, ...rest } = data;
    void _ignore;
    const { data: row, error } = await supabase
      .from("kuanyin_clients")
      .insert({ ...rest, user_id: userId } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClientInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("kuanyin_clients")
      .update(rest as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("kuanyin_clients")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recognizeClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = data.query;
    const { data: rows, error } = await supabase
      .from("kuanyin_clients")
      .select("*")
      .eq("user_id", userId)
      .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── kuanyin_appointments ────────────────────────────────────────────────────

const AppointmentInput = z.object({
  client_id: z.string().uuid().nullable().optional(),
  service_name: z.string().trim().min(1).max(200),
  starts_at: z.string().datetime({ offset: true }).or(z.string().min(1)),
  ends_at: z.string().datetime({ offset: true }).or(z.string().min(1)).nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const proposeAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AppointmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_appointments")
      .insert({ ...data, status: "proposed", user_id: userId } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const confirmAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // 1. update appointment status
    const { data: appt, error } = await supabase
      .from("kuanyin_appointments")
      .update({ status: "confirmed" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // 2. mirror em eventos (calendário Kaline) — best-effort
    try {
      const a = appt as unknown as {
        id: string;
        service_name: string;
        starts_at: string;
        ends_at: string | null;
        notes: string | null;
      };
      const { data: ev } = await supabase
        .from("eventos")
        .insert({
          user_id: userId,
          titulo: `Kuan-Yin · ${a.service_name}`,
          descricao: a.notes ?? null,
          tipo: "compromisso",
          inicio: a.starts_at,
          fim: a.ends_at ?? a.starts_at,
        } as never)
        .select("id")
        .single();
      if (ev) {
        await supabase
          .from("kuanyin_appointments")
          .update({ evento_id: (ev as { id: string }).id } as never)
          .eq("id", a.id)
          .eq("user_id", userId);
      }
    } catch {
      // segue mesmo se calendário falhar
    }
    return appt;
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_appointments")
      .update({ status: "cancelled" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("kuanyin_appointments")
      .select("*, kuanyin_clients(nome)")
      .eq("user_id", userId)
      .order("starts_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── kuanyin_orders ──────────────────────────────────────────────────────────

const OrderInput = z.object({
  client_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  items: z.array(JsonValue).optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["draft", "proposed"]).optional(),
});

export const proposeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_orders")
      .insert({ ...data, status: data.status ?? "proposed", user_id: userId } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const confirmOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_orders")
      .update({ status: "confirmed" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_orders")
      .update({ status: "cancelled" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("kuanyin_orders")
      .select("*, kuanyin_clients(nome)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── kuanyin_payments ────────────────────────────────────────────────────────

const ProofInput = z.object({
  order_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  amount_cents: z.number().int().nonnegative(),
  method: z.string().trim().max(80).nullable().optional(),
  comprovante_ref: z.string().trim().max(500).nullable().optional(),
  fraud_alert_note: z.string().trim().max(1000).nullable().optional(),
});

// Invariante: registro de comprovante NUNCA marca verified.
export const registerProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProofInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_payments")
      .insert({ ...data, status: "received_proof", user_id: userId } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Verificação só por ação humana explícita.
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_payments")
      .update({ status: "verified" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const rejectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(1000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_payments")
      .update({ status: "rejected", fraud_alert_note: data.note ?? null } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("kuanyin_payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── kuanyin_portal_tokens (links públicos) ──────────────────────────────────

const TokenCreate = z.object({
  scope: z.enum(["appointment", "order"]),
  appointment_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  label: z.string().trim().max(200).optional(),
  days_valid: z.number().int().min(1).max(60).optional(),
});

export const createPortalToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TokenCreate.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const expires = new Date(Date.now() + (data.days_valid ?? 14) * 86400_000).toISOString();
    const payload = {
      user_id: userId,
      scope: data.scope,
      appointment_id: data.scope === "appointment" ? (data.appointment_id ?? null) : null,
      order_id: data.scope === "order" ? (data.order_id ?? null) : null,
      label: data.label ?? null,
      expires_at: expires,
    };
    const { data: row, error } = await supabase
      .from("kuanyin_portal_tokens")
      .insert(payload as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listPortalTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("kuanyin_portal_tokens")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokePortalToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("kuanyin_portal_tokens")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── kuanyin_integrity_logs ──────────────────────────────────────────────────

export const listIntegrityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("kuanyin_integrity_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
