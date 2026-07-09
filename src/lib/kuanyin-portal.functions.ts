// Server functions PÚBLICAS do Portal do Cliente Kuan-Yin.
// Autenticação por token (uuid do registro `kuanyin_portal_tokens`).
// O token, sozinho, vale como credencial de acesso restrita ao alvo apontado.
// Usa supabaseAdmin com dynamic import (após validar o token) para ler/escrever
// somente as linhas autorizadas pelo escopo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const TokenInput = z.object({ token: z.string().uuid() });

// Rate-limit por token (a credencial do portal). O portal é público — sem isso,
// quem tiver um token válido pode floodar comprovantes/decisões ou marteladar a
// leitura. Best-effort em memória por isolate (mesma ressalva de src/lib/rate-limit.ts),
// mas já barra o abuso trivial de um único cliente.
function portalRateLimited(
  token: string,
  action: string,
  limit: number,
  windowSec: number,
): boolean {
  return !checkRateLimit(`portal:${action}:${token}`, limit, windowSec).ok;
}

type PortalTokenRow = {
  id: string;
  user_id: string;
  scope: "appointment" | "order";
  appointment_id: string | null;
  order_id: string | null;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
};

async function loadValidToken(token: string): Promise<PortalTokenRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("kuanyin_portal_tokens")
    .select("id, user_id, scope, appointment_id, order_id, label, expires_at, revoked_at")
    .eq("id", token)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as PortalTokenRow;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export const getPortalView = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenInput.parse(i))
  .handler(async ({ data }) => {
    if (portalRateLimited(data.token, "view", 60, 60)) {
      return { ok: false as const, reason: "rate_limited" };
    }
    const tok = await loadValidToken(data.token);
    if (!tok) return { ok: false as const, reason: "invalid_or_expired" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // contexto do negócio (nome + tom + pix) — só campos seguros
    const { data: biz } = await supabaseAdmin
      .from("business_contexts")
      .select("nome, tipo, tom_voz, pix_chave, formas_pagamento")
      .eq("user_id", tok.user_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tok.scope === "appointment" && tok.appointment_id) {
      const { data: appt } = await supabaseAdmin
        .from("kuanyin_appointments")
        .select(
          "id, service_name, starts_at, ends_at, price_cents, status, notes, kuanyin_clients(nome)",
        )
        .eq("id", tok.appointment_id)
        .maybeSingle();
      if (!appt) return { ok: false as const, reason: "not_found" };
      return {
        ok: true as const,
        kind: "appointment" as const,
        target: appt,
        business: biz,
        token: tok.id,
      };
    }
    if (tok.scope === "order" && tok.order_id) {
      const { data: ord } = await supabaseAdmin
        .from("kuanyin_orders")
        .select("id, description, items, price_cents, status, kuanyin_clients(nome)")
        .eq("id", tok.order_id)
        .maybeSingle();
      if (!ord) return { ok: false as const, reason: "not_found" };
      return {
        ok: true as const,
        kind: "order" as const,
        target: ord,
        business: biz,
        token: tok.id,
      };
    }
    return { ok: false as const, reason: "invalid_scope" };
  });

const ProofInput = z.object({
  token: z.string().uuid(),
  amount_cents: z.number().int().nonnegative(),
  method: z.string().trim().max(80).optional(),
  comprovante_ref: z.string().trim().max(500).optional(),
  payer_note: z.string().trim().max(1000).optional(),
});

export const submitPortalProof = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ProofInput.parse(i))
  .handler(async ({ data }) => {
    if (portalRateLimited(data.token, "proof", 5, 60)) {
      return { ok: false as const, reason: "rate_limited" };
    }
    const tok = await loadValidToken(data.token);
    if (!tok) return { ok: false as const, reason: "invalid_or_expired" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      user_id: tok.user_id,
      appointment_id: tok.scope === "appointment" ? tok.appointment_id : null,
      order_id: tok.scope === "order" ? tok.order_id : null,
      amount_cents: data.amount_cents,
      method: data.method ?? null,
      comprovante_ref: data.comprovante_ref ?? null,
      status: "received_proof" as const,
      metadata: { source: "portal", payer_note: data.payer_note ?? null, token_id: tok.id },
    };
    const { error } = await supabaseAdmin.from("kuanyin_payments").insert(payload as never);
    if (error) return { ok: false as const, reason: error.message };
    return { ok: true as const };
  });

const ConfirmInput = z.object({ token: z.string().uuid(), accept: z.boolean() });

// Cliente pode aceitar a proposta de agendamento (sinal não vinculante).
// NÃO marca como "confirmed" — registra resposta do cliente em metadata e
// muda status para `proposed` mantendo (ou `cancelled` se recusou).
// Confirmação final continua sendo ação do guardião.
export const submitPortalDecision = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ConfirmInput.parse(i))
  .handler(async ({ data }) => {
    if (portalRateLimited(data.token, "decision", 10, 60)) {
      return { ok: false as const, reason: "rate_limited" };
    }
    const tok = await loadValidToken(data.token);
    if (!tok) return { ok: false as const, reason: "invalid_or_expired" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (tok.scope === "appointment" && tok.appointment_id) {
      const patch = data.accept
        ? {
            metadata: {
              client_decision: "accepted",
              at: new Date().toISOString(),
              token_id: tok.id,
            },
          }
        : {
            status: "cancelled" as const,
            metadata: {
              client_decision: "declined",
              at: new Date().toISOString(),
              token_id: tok.id,
            },
          };
      const { error } = await supabaseAdmin
        .from("kuanyin_appointments")
        .update(patch as never)
        .eq("id", tok.appointment_id);
      if (error) return { ok: false as const, reason: error.message };
      return { ok: true as const };
    }
    if (tok.scope === "order" && tok.order_id) {
      const patch = data.accept
        ? {
            metadata: {
              client_decision: "accepted",
              at: new Date().toISOString(),
              token_id: tok.id,
            },
          }
        : {
            status: "cancelled" as const,
            metadata: {
              client_decision: "declined",
              at: new Date().toISOString(),
              token_id: tok.id,
            },
          };
      const { error } = await supabaseAdmin
        .from("kuanyin_orders")
        .update(patch as never)
        .eq("id", tok.order_id);
      if (error) return { ok: false as const, reason: error.message };
      return { ok: true as const };
    }
    return { ok: false as const, reason: "invalid_scope" };
  });
