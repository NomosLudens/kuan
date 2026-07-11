// Server functions da faceta Kuan-Yin (camada comercial sobre Kaline).
// Escopadas por usuário via requireSupabaseAuth + RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeKuanIntegrityLog } from "@/lib/kuanyin-integrity";
import { z } from "zod";
import { normalizeAvailabilityRules, isPastOrTooSoon } from "@/lib/kuan/availability-rules";
import {
  parseLocalDateTimeInTimeZone,
  isAppointmentWithinAvailabilityRules,
} from "@/lib/kuan/calendar";
import { requirePlatformAdmin, getCanonicalAppUrl, validateSafeRedirectUrl } from "@/lib/admin-security";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── ownership assertions ───────────────────────────────────────────────────

async function assertOwnedClient(supabase: SupabaseClient, userId: string, clientId: string | null | undefined): Promise<void> {
  if (!clientId) return;
  const { data, error } = await supabase
    .from("kuanyin_clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Acesso não autorizado ao cliente.");
  }
}

async function assertOwnedAppointment(supabase: SupabaseClient, userId: string, appointmentId: string | null | undefined): Promise<void> {
  if (!appointmentId) return;
  const { data, error } = await supabase
    .from("kuanyin_appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Acesso não autorizado ao agendamento.");
  }
}

async function assertOwnedOrder(supabase: SupabaseClient, userId: string, orderId: string | null | undefined): Promise<void> {
  if (!orderId) return;
  const { data, error } = await supabase
    .from("kuanyin_orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Acesso não autorizado ao pedido.");
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | JsonSerializable[]
  | { [key: string]: JsonSerializable };

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

async function assertGuardianSlugAvailable(
  publicSlug: string,
  businessContextId: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("kuanyin_guardians")
    .select("id, business_context_id")
    .eq("public_slug", publicSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data && (data as { business_context_id: string }).business_context_id !== businessContextId) {
    throw new Error("Este slug público já está em uso por outro Guardião.");
  }
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

async function getEditableGuardianForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: owned, error: ownedError } = await supabaseAdmin
    .from("kuanyin_guardians")
    .select("id, user_id, admin_user_id, business_context_id, public_slug, status, metadata")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ownedError) throw new Error(ownedError.message);
  if (owned) return owned as GuardianLinkRow;

  const { data: managed, error: managedError } = await supabaseAdmin
    .from("kuanyin_guardians")
    .select("id, user_id, admin_user_id, business_context_id, public_slug, status, metadata")
    .eq("admin_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(2);
  if (managedError) throw new Error(managedError.message);
  const rows = (managed ?? []) as GuardianLinkRow[];
  if (rows.length > 1) {
    throw new Error(
      "Mais de um Guardião é gerenciado por esta conta. Entre como o Guardião operacional para editar /kuan/config.",
    );
  }
  return rows[0] ?? null;
}

type GuardianLinkRow = {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  business_context_id: string;
  public_slug: string;
  status: string;
  metadata: Record<string, JsonSerializable> | null;
};

function genGuardianInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const GuardianStatus = z.enum(["draft", "published", "suspended", "archived"]);

const GuardianPreferencesInput = z.object({
  tone_preference: z.string().trim().max(500).optional().default(""),
  formality_level: z.enum(["formal", "casual", "mixed"]).optional().default("mixed"),
  visual_style: z.string().trim().max(500).optional().default(""),
  client_style: z.string().trim().max(500).optional().default(""),
  preferred_cta: z.string().trim().max(200).optional().default("Solicitar esse horário"),
  autonomy_limits: z.array(z.string().trim().max(200)).optional().default([]),
  must_review: z.array(z.string().trim().max(200)).optional().default([]),
  avoid_terms: z.array(z.string().trim().max(120)).optional().default([]),
  preferred_jargon: z.array(z.string().trim().max(120)).optional().default([]),
  notes: z.string().trim().max(2000).optional().default(""),
});

const PublicPageBlueprintInput = z.object({
  status: z.enum(["draft", "proposed", "approved", "published"]).optional().default("draft"),
  theme: z
    .object({
      palette: z.string().trim().max(200).optional().default(""),
      mood: z.string().trim().max(200).optional().default(""),
      typography: z.string().trim().max(200).optional().default(""),
    })
    .optional()
    .default({ palette: "", mood: "", typography: "" }),
  journey: z.array(z.string().trim().max(80)).optional().default([]),
  sections: z.array(JsonValue).optional().default([]),
  suggested_copy: z.record(z.string(), JsonValue).optional().default({}),
  warnings: z.array(z.string().trim().max(300)).optional().default([]),
});

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
  guardian_preferences: GuardianPreferencesInput.optional(),
  public_page_blueprint: PublicPageBlueprintInput.optional(),
});

export const getBusinessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const guardian = await getEditableGuardianForUser(userId);
    if (!guardian) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("business_contexts")
      .select("*")
      .eq("id", guardian.business_context_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      ...(data as Record<string, unknown>),
      public_slug: guardian.public_slug,
      public_status: guardian.status,
      guardian_metadata: guardian.metadata ?? {},
    };
  });

export const upsertBusinessContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BusinessContextInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const {
      public_slug: requestedSlug,
      guardian_preferences: guardianPreferences,
      public_page_blueprint: publicPageBlueprint,
      ...businessData
    } = data;
    const editableGuardian = await getEditableGuardianForUser(userId);
    if (!editableGuardian) {
      throw new Error("Nenhum Guardião vinculado a esta conta. Peça um convite ao admin.");
    }

    const businessContextId = data.id ?? editableGuardian.business_context_id;
    if (data.id && data.id !== editableGuardian.business_context_id) {
      throw new Error("Este contexto de negócio não pertence ao Guardião vinculado a esta conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      ...businessData,
      id: businessContextId,
      user_id: editableGuardian.user_id,
    } as never;
    const { data: existingContext, error: existingError } = await supabaseAdmin
      .from("business_contexts")
      .select("id")
      .eq("id", businessContextId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const query = existingContext
      ? supabaseAdmin.from("business_contexts").update(payload).eq("id", businessContextId)
      : supabaseAdmin.from("business_contexts").insert(payload);
    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);

    const businessRow = row as unknown as { id: string; nome: string };
    const baseSlug = normalizePublicSlug(requestedSlug ?? businessRow.nome, businessRow.nome);
    await assertGuardianSlugAvailable(baseSlug, businessRow.id);
    const guardianMetadata = {
      ...(editableGuardian.metadata ?? {}),
      ...(guardianPreferences ? { guardian_preferences: guardianPreferences } : {}),
      ...(publicPageBlueprint ? { public_page_blueprint: publicPageBlueprint } : {}),
    };
    const { data: guardian, error: guardianError } = await supabaseAdmin
      .from("kuanyin_guardians")
      .update({
        business_context_id: businessRow.id,
        public_slug: baseSlug,
        status: editableGuardian.status || "draft",
        metadata: guardianMetadata,
      } as never)
      .eq("id", editableGuardian.id)
      .select("id, public_slug, status")
      .single();
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
  .middleware([requirePlatformAdmin])
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
      metadata: Record<string, JsonSerializable> | null;
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
  .middleware([requirePlatformAdmin])
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

    // Validate Safe Redirect URL using getCanonicalAppUrl()
    const appUrl = getCanonicalAppUrl();
    const safeOrigin = validateSafeRedirectUrl(data.origin, appUrl);

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

    const acceptUrl = `${safeOrigin.replace(/\/$/, "")}/convite?token=${token}`;
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
    if (data.client_id) {
      await assertOwnedClient(supabase, userId, data.client_id);
    }
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

    // 1. Fetch current appointment
    const { data: targetAppt, error: findError } = await supabase
      .from("kuanyin_appointments")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();

    if (findError || !targetAppt) {
      throw new Error("Agendamento não encontrado.");
    }

    if (targetAppt.status === "confirmed") {
      return targetAppt; // Idempotente
    }

    if (targetAppt.status !== "proposed") {
      throw new Error("O agendamento precisa estar em status proposto para ser confirmado.");
    }

    // 2. Calcular ends_at caso esteja vazio
    let endsAtStr = targetAppt.ends_at;
    if (!endsAtStr) {
      const { data: bContext } = await supabase
        .from("business_contexts")
        .select("regras_agenda")
        .eq("id", targetAppt.business_context_id!)
        .single();
      const rules = normalizeAvailabilityRules(bContext?.regras_agenda);
      const duration = rules.defaultDurationMinutes || 60;
      const startsAtDate = new Date(targetAppt.starts_at);
      const endsAtDate = new Date(startsAtDate.getTime() + duration * 60 * 1000);
      endsAtStr = endsAtDate.toISOString();
    }

    // 3. Validar se há conflitos com agendamentos confirmados
    const { data: conflicts } = await supabase
      .from("kuanyin_appointments")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .lt("starts_at", endsAtStr)
      .gt("ends_at", targetAppt.starts_at)
      .not("id", "eq", data.id)
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      throw new Error("Esse horário já tem compromisso confirmado. Escolha outro horário ou envie uma observação.");
    }

    // 4. Update status and ends_at
    const { data: appt, error } = await supabase
      .from("kuanyin_appointments")
      .update({ status: "confirmed", ends_at: endsAtStr } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "proposed")
      .select("*")
      .single();

    if (error) {
      throw new Error("O agendamento precisa estar em status proposto para ser confirmado.");
    }

    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "appointment status changed: proposed -> confirmed",
      excerpt: `appointment_id:${data.id}`,
    });

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
      .in("status", ["proposed", "confirmed"])
      .select("*")
      .single();
    if (error || !row) {
      throw new Error("Apenas agendamentos propostos ou confirmados podem ser cancelados.");
    }
    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "appointment status changed: any -> cancelled",
      excerpt: `appointment_id:${data.id}`,
    });
    return row;
  });

export const completeAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_appointments")
      .update({ status: "completed" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .select("*")
      .single();

    if (error || !row) {
      throw new Error("O agendamento precisa estar confirmado para ser concluído.");
    }

    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "appointment status changed: confirmed -> completed",
      excerpt: `appointment_id:${data.id}`,
    });

    return row;
  });

export const createManualAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        client_name: z.string().trim().min(1).max(200),
        client_phone: z.string().trim().max(40).nullable().optional(),
        client_email: z
          .string()
          .trim()
          .email()
          .max(200)
          .nullable()
          .optional()
          .or(z.literal("").transform(() => null)),
        service_name: z.string().trim().min(1).max(200),
        starts_at: z.string().min(1),
        notes: z.string().trim().max(4000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch the current business context ID for the logged-in user
    const guardian = await getEditableGuardianForUser(userId);
    const businessContextId = guardian?.business_context_id || null;

    // 1. Find or create client
    let clientId: string | null = null;

    if (data.client_email) {
      const { data: foundByEmail } = await supabase
        .from("kuanyin_clients")
        .select("id")
        .eq("user_id", userId)
        .eq("email", data.client_email)
        .limit(1)
        .maybeSingle();
      if (foundByEmail) clientId = foundByEmail.id;
    }

    if (!clientId && data.client_phone) {
      const { data: foundByPhone } = await supabase
        .from("kuanyin_clients")
        .select("id")
        .eq("user_id", userId)
        .eq("telefone", data.client_phone)
        .limit(1)
        .maybeSingle();
      if (foundByPhone) clientId = foundByPhone.id;
    }

    if (!clientId) {
      const { data: newClient, error: clientError } = await supabase
        .from("kuanyin_clients")
        .insert({
          user_id: userId,
          nome: data.client_name,
          email: data.client_email ?? null,
          telefone: data.client_phone || null,
          status: "confirmed",
          metadata: { source: "manual_scheduling" },
        } as never)
        .select("id")
        .single();
      if (clientError) throw new Error(`Falha ao criar cliente: ${clientError.message}`);
      clientId = newClient.id;
    }

    if (!businessContextId) {
      throw new Error("Guardião não possui um contexto comercial configurado.");
    }

    // Normalizar regras de agenda e timezone
    const { data: bContext } = await supabase
      .from("business_contexts")
      .select("regras_agenda")
      .eq("id", businessContextId)
      .single();

    const rules = normalizeAvailabilityRules(bContext?.regras_agenda);
    const timeZone = rules.timezone || "America/Sao_Paulo";

    // Converte e valida o fuso horário
    let startsAtDate: Date;
    try {
      startsAtDate = parseLocalDateTimeInTimeZone(data.starts_at, timeZone);
    } catch {
      throw new Error("Não consegui interpretar esse horário. Escolha novamente a data e a hora.");
    }

    const duration = rules.defaultDurationMinutes || 60;
    const endsAtDate = new Date(startsAtDate.getTime() + duration * 60 * 1000);

    // Valida se o horário proposto está na janela permitida
    if (!isAppointmentWithinAvailabilityRules(startsAtDate, duration, rules, timeZone)) {
      throw new Error(rules.unavailableMessage || "Horário fora da janela de atendimento configurada.");
    }

    // Valida antecedência mínima / se já passou
    if (isPastOrTooSoon(startsAtDate, rules)) {
      throw new Error("Esse horário já passou ou está muito próximo.");
    }

    // Valida conflito de agenda no intervalo [starts_at, ends_at)
    const { data: conflicts, error: conflictError } = await supabase
      .from("kuanyin_appointments")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .lt("starts_at", endsAtDate.toISOString())
      .gt("ends_at", startsAtDate.toISOString())
      .limit(1);

    if (conflictError) throw new Error(conflictError.message);
    if (conflicts && conflicts.length > 0) {
      throw new Error("Esse horário já tem compromisso confirmado. Escolha outro horário ou envie uma observação.");
    }

    // 3. Insert appointment directly as confirmed (pre-confirmed)
    const { data: appt, error: apptError } = await supabase
      .from("kuanyin_appointments")
      .insert({
        user_id: userId,
        client_id: clientId,
        business_context_id: businessContextId,
        service_name: data.service_name,
        starts_at: startsAtDate.toISOString(),
        ends_at: endsAtDate.toISOString(),
        status: "confirmed",
        notes: data.notes || null,
        metadata: {
          source: "manual_scheduling",
          scheduled_at: new Date().toISOString(),
        },
      } as never)
      .select("*")
      .single();

    if (apptError) throw new Error(`Falha ao criar agendamento: ${apptError.message}`);

    // 3. Write integrity log
    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "manual appointment created as confirmed",
      excerpt: `appointment_id:${appt.id}`,
    });

    // 4. Mirror in eventos (Kaline calendar) — best-effort
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
      // ignore
    }

    return appt;
  });

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    // 1. Futuros (starts_at >= now), asc
    const { data: future, error: errorFuture } = await supabase
      .from("kuanyin_appointments")
      .select("*, kuanyin_clients(nome, telefone, email)")
      .eq("user_id", userId)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(200);

    if (errorFuture) throw new Error(errorFuture.message);

    // 2. Passados (starts_at < now), desc, limitado
    const { data: past, error: errorPast } = await supabase
      .from("kuanyin_appointments")
      .select("*, kuanyin_clients(nome, telefone, email)")
      .eq("user_id", userId)
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(50);

    if (errorPast) throw new Error(errorPast.message);

    const combined = [...(past ?? []), ...(future ?? [])];
    combined.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    return combined;
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
    if (data.client_id) {
      await assertOwnedClient(supabase, userId, data.client_id);
    }
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
      .in("status", ["draft", "proposed"])
      .select("*")
      .single();
    if (error || !row) {
      throw new Error("O pedido precisa estar com status 'draft' ou 'proposed' para ser confirmado.");
    }
    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "order status changed: proposed/draft -> confirmed",
      excerpt: `order_id:${data.id}`,
    });
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
      .in("status", ["draft", "proposed", "confirmed"])
      .select("*")
      .single();
    if (error || !row) {
      throw new Error("Apenas pedidos em rascunho, propostos ou confirmados podem ser cancelados.");
    }
    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "order status changed: any -> cancelled",
      excerpt: `order_id:${data.id}`,
    });
    return row;
  });

export const deliverOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("kuanyin_orders")
      .update({ status: "delivered" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .select("*")
      .single();

    if (error || !row) {
      throw new Error("O pedido precisa estar confirmado para ser entregue.");
    }

    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "order status changed: confirmed -> delivered",
      excerpt: `order_id:${data.id}`,
    });

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
    if (data.order_id) {
      await assertOwnedOrder(supabase, userId, data.order_id);
    }
    if (data.appointment_id) {
      await assertOwnedAppointment(supabase, userId, data.appointment_id);
    }
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
      .eq("status", "received_proof")
      .select("*")
      .single();
    if (error || !row) {
      throw new Error("O pagamento precisa estar com status 'received_proof' para ser verificado.");
    }
    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "payment status changed: received_proof -> verified",
      excerpt: `payment_id:${data.id}`,
    });
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
      .eq("status", "received_proof")
      .select("*")
      .single();
    if (error || !row) {
      throw new Error("O pagamento precisa estar com status 'received_proof' para ser rejeitado.");
    }
    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "commercial_status_change",
      note: "payment status changed: any -> rejected",
      excerpt: `payment_id:${data.id}`,
    });
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
    if (data.scope === "appointment" && data.appointment_id) {
      await assertOwnedAppointment(supabase, userId, data.appointment_id);
    }
    if (data.scope === "order" && data.order_id) {
      await assertOwnedOrder(supabase, userId, data.order_id);
    }
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
