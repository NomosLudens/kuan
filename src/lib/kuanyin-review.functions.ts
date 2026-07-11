import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeKuanIntegrityLog } from "@/lib/kuanyin-integrity";
import { z } from "zod";
import {
  CommercialReviewActor,
  validateAppointmentTransition,
  validateOrderTransition,
  validatePaymentTransition,
} from "./kuan/commercial-review-policy";

export type ReviewItemType =
  | "kuanyin.client.review"
  | "kuanyin.appointment.review"
  | "kuanyin.order.review"
  | "kuanyin.payment.review";

export interface ReviewItem {
  id: string;
  type: ReviewItemType;
  title: string;
  details: string;
  status: string;
  createdAt: string;
}

/**
 * Resolves the authenticated actor based on their authenticated identity and roles.
 */
async function resolveReviewActor(
  supabase: any,
  userId: string,
  reviewGuardianId?: string | null,
): Promise<CommercialReviewActor> {
  // Check if admin
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = !!roleRow;

  if (isAdmin) {
    if (!reviewGuardianId) {
      throw new Error("Admin acting without explicit guardian scope is not allowed.");
    }
    const { data: guardianRow, error: guardianError } = await supabase
      .from("kuanyin_guardians")
      .select("id")
      .eq("id", reviewGuardianId)
      .maybeSingle();

    if (!guardianRow || guardianError) {
      throw new Error(`Guardian with ID ${reviewGuardianId} not found.`);
    }

    return {
      actorUserId: userId,
      role: "platform_admin",
      guardianId: reviewGuardianId,
    };
  }

  // Normal guardian
  const { data: guardianRow, error: guardianError } = await supabase
    .from("kuanyin_guardians")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!guardianRow || guardianError) {
    throw new Error("Unauthorized: User is neither an admin nor a registered guardian.");
  }

  return {
    actorUserId: userId,
    role: "guardian",
    guardianId: guardianRow.id,
  };
}

/**
 * Core implementation for listing commercial review items.
 */
export async function listKuanCommercialReviewItemsImpl(
  supabase: any,
  userId: string,
  guardianId?: string | null,
): Promise<ReviewItem[]> {
  // Resolve actor details
  const actor = await resolveReviewActor(supabase, userId, guardianId);

  if (!actor.guardianId) {
    throw new Error("Guardian ID could not be resolved for this actor.");
  }

  // Resolve target guardian's contextual IDs
  const { data: targetGuardian, error: tgError } = await supabase
    .from("kuanyin_guardians")
    .select("id, user_id, business_context_id")
    .eq("id", actor.guardianId)
    .single();

  if (!targetGuardian || tgError) {
    throw new Error("Target guardian details could not be resolved.");
  }

  const targetUserId = targetGuardian.user_id;

  const [appointmentsRes, ordersRes, paymentsRes, clientsRes, msgContactsRes] = await Promise.all([
    supabase
      .from("kuanyin_appointments")
      .select("id, service_name, starts_at, price_cents, status, created_at")
      .eq("user_id", targetUserId)
      .eq("status", "proposed"),
    supabase
      .from("kuanyin_orders")
      .select("id, description, price_cents, status, created_at")
      .eq("user_id", targetUserId)
      .eq("status", "proposed"),
    supabase
      .from("kuanyin_payments")
      .select("id, amount_cents, method, status, created_at")
      .eq("user_id", targetUserId)
      .in("status", ["received_proof", "pending_review"]),
    supabase
      .from("kuanyin_clients")
      .select("id, nome, email, telefone, status, created_at")
      .eq("user_id", targetUserId)
      .eq("status", "prospect"),
    supabase
      .from("kuanyin_public_chat_messages")
      .select("id, content, created_at")
      .eq("user_id", targetUserId)
      .like("content", "📬 [Contato deixado]%"),
  ]);

  const items: ReviewItem[] = [];

  if (clientsRes.data) {
    for (const c of clientsRes.data) {
      items.push({
        id: c.id,
        type: "kuanyin.client.review",
        title: c.nome,
        details: `E-mail: ${c.email || "-"} | Tel: ${c.telefone || "-"}`,
        status: c.status,
        createdAt: c.created_at,
      });
    }
  }

  if (msgContactsRes.data) {
    for (const m of msgContactsRes.data) {
      // Strip the standard prefix for a beautiful representation
      const cleanDetails = m.content.replace("📬 [Contato deixado] ", "").trim();
      items.push({
        id: m.id,
        type: "kuanyin.client.review",
        title: "Contato da Conversa Pública",
        details: cleanDetails,
        status: "prospect",
        createdAt: m.created_at,
      });
    }
  }

  if (appointmentsRes.data) {
    for (const a of appointmentsRes.data) {
      const val = a.price_cents ? `R$ ${(a.price_cents / 100).toFixed(2)}` : "Sem valor";
      const date = new Date(a.starts_at).toLocaleString("pt-BR");
      items.push({
        id: a.id,
        type: "kuanyin.appointment.review",
        title: a.service_name,
        details: `${date} - ${val}`,
        status: a.status,
        createdAt: a.created_at,
      });
    }
  }

  if (ordersRes.data) {
    for (const o of ordersRes.data) {
      const val = o.price_cents ? `R$ ${(o.price_cents / 100).toFixed(2)}` : "Sem valor";
      items.push({
        id: o.id,
        type: "kuanyin.order.review",
        title: o.description,
        details: `Valor: ${val}`,
        status: o.status,
        createdAt: o.created_at,
      });
    }
  }

  if (paymentsRes.data) {
    for (const p of paymentsRes.data) {
      const val = `R$ ${(p.amount_cents / 100).toFixed(2)}`;
      items.push({
        id: p.id,
        type: "kuanyin.payment.review",
        title: `Comprovante via ${p.method || "Desconhecido"}`,
        details: `Valor: ${val}`,
        status: p.status,
        createdAt: p.created_at,
      });
    }
  }

  items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return items;
}

/**
 * Lists all commercial review items for the resolved guardian.
 */
export const listKuanCommercialReviewItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ guardianId: z.string().uuid().optional() })
      .optional()
      .parse(input || {}),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    return listKuanCommercialReviewItemsImpl(supabase, userId, data?.guardianId);
  });

/**
 * Core implementation for reviewing pending appointments.
 */
export async function reviewKuanAppointmentImpl(
  supabase: any,
  userId: string,
  data: {
    id: string;
    action: "confirm" | "reject";
    note?: string;
    guardianId?: string;
  },
): Promise<{ ok: boolean; status: string }> {
  const actor = await resolveReviewActor(supabase, userId, data.guardianId);

  const { data: entity, error: fetchError } = await supabase
    .from("kuanyin_appointments")
    .select("id, status, user_id, metadata, business_context_id, service_name, starts_at")
    .eq("id", data.id)
    .single();

  if (fetchError || !entity) {
    throw new Error("Agendamento não encontrado ou indisponível.");
  }

  const { data: entityGuardian, error: egError } = await supabase
    .from("kuanyin_guardians")
    .select("id")
    .eq("user_id", entity.user_id)
    .single();

  if (egError || !entityGuardian) {
    throw new Error("Não foi possível verificar a propriedade do agendamento.");
  }

  const targetStatus = data.action === "confirm" ? "confirmed" : "rejected";

  // Validate transition
  validateAppointmentTransition(entity.status, targetStatus, actor, entityGuardian.id);

  // Update row with metadata
  const existingMetadata =
    entity.metadata && typeof entity.metadata === "object" ? entity.metadata : {};
  const updatedMetadata = {
    ...existingMetadata,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    review_action: targetStatus,
    review_note: data.note || null,
  };

  const { data: updated, error: updateError } = await supabase
    .from("kuanyin_appointments")
    .update({
      status: targetStatus,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", data.id)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    throw new Error("Falha ao atualizar o status do agendamento.");
  }

  // Write integrity log
  const logPayload = {
    actor_user_id: actor.actorUserId,
    guardian_id: actor.guardianId,
    entity_type: "appointment",
    entity_id: data.id,
    from_status: entity.status,
    to_status: targetStatus,
    action: data.action,
    created_at: new Date().toISOString(),
  };

  await writeKuanIntegrityLog({
    supabase,
    userId: actor.actorUserId,
    category: "commercial_review",
    severity: "info",
    note: JSON.stringify(logPayload),
    excerpt: `reviewed_appointment_action:${data.action} id:${data.id}`,
  });

  // Append public thread feedback if recoverable
  const threadId = (existingMetadata as any)?.thread_id || (existingMetadata as any)?.threadId;
  if (threadId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const feedbackMsg =
        targetStatus === "confirmed"
          ? "Seu horário foi confirmado pelo Guardião."
          : "O Guardião não conseguiu confirmar esse horário. Você pode solicitar outro horário.";

      await supabaseAdmin.from("kuanyin_public_chat_messages").insert({
        thread_id: threadId,
        guardian_id: entityGuardian.id,
        user_id: entity.user_id,
        role: "kuanyin",
        content: feedbackMsg,
      } as never);

      await supabaseAdmin
        .from("kuanyin_public_chat_threads")
        .update({ updated_at: new Date().toISOString() } as never)
        .eq("id", threadId);
    } catch (err) {
      console.error("Failed to append public chat feedback:", err);
    }
  }

  return { ok: true, status: updated.status };
}

/**
 * Reviews a pending appointment.
 */
export const reviewKuanAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["confirm", "reject"]),
        note: z.string().trim().max(1000).optional(),
        guardianId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    return reviewKuanAppointmentImpl(supabase, userId, data);
  });

/**
 * Core implementation for reviewing pending orders.
 */
export async function reviewKuanOrderImpl(
  supabase: any,
  userId: string,
  data: {
    id: string;
    action: "accept" | "reject";
    note?: string;
    guardianId?: string;
  },
): Promise<{ ok: boolean; status: string }> {
  const actor = await resolveReviewActor(supabase, userId, data.guardianId);

  const { data: entity, error: fetchError } = await supabase
    .from("kuanyin_orders")
    .select("id, status, user_id, metadata, business_context_id, description")
    .eq("id", data.id)
    .single();

  if (fetchError || !entity) {
    throw new Error("Pedido não encontrado ou indisponível.");
  }

  const { data: entityGuardian, error: egError } = await supabase
    .from("kuanyin_guardians")
    .select("id")
    .eq("user_id", entity.user_id)
    .single();

  if (egError || !entityGuardian) {
    throw new Error("Não foi possível verificar a propriedade do pedido.");
  }

  const targetStatus = data.action === "accept" ? "accepted" : "rejected";

  // Validate transition
  validateOrderTransition(entity.status, targetStatus, actor, entityGuardian.id);

  // Update row with metadata
  const existingMetadata =
    entity.metadata && typeof entity.metadata === "object" ? entity.metadata : {};
  const updatedMetadata = {
    ...existingMetadata,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    review_action: targetStatus,
    review_note: data.note || null,
  };

  const { data: updated, error: updateError } = await supabase
    .from("kuanyin_orders")
    .update({
      status: targetStatus,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", data.id)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    throw new Error("Falha ao atualizar o status do pedido.");
  }

  // Write integrity log
  const logPayload = {
    actor_user_id: actor.actorUserId,
    guardian_id: actor.guardianId,
    entity_type: "order",
    entity_id: data.id,
    from_status: entity.status,
    to_status: targetStatus,
    action: data.action,
    created_at: new Date().toISOString(),
  };

  await writeKuanIntegrityLog({
    supabase,
    userId: actor.actorUserId,
    category: "commercial_review",
    severity: "info",
    note: JSON.stringify(logPayload),
    excerpt: `reviewed_order_action:${data.action} id:${data.id}`,
  });

  // Append public thread feedback if recoverable
  const threadId = (existingMetadata as any)?.thread_id || (existingMetadata as any)?.threadId;
  if (threadId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const feedbackMsg =
        data.action === "accept"
          ? "O Guardião aceitou analisar/seguir com este pedido. Aguarde os próximos detalhes."
          : "O Guardião não conseguiu aceitar este pedido neste momento.";

      await supabaseAdmin.from("kuanyin_public_chat_messages").insert({
        thread_id: threadId,
        guardian_id: entityGuardian.id,
        user_id: entity.user_id,
        role: "kuanyin",
        content: feedbackMsg,
      } as never);

      await supabaseAdmin
        .from("kuanyin_public_chat_threads")
        .update({ updated_at: new Date().toISOString() } as never)
        .eq("id", threadId);
    } catch (err) {
      console.error("Failed to append public chat feedback:", err);
    }
  }

  return { ok: true, status: updated.status };
}

/**
 * Reviews a pending order.
 */
export const reviewKuanOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["accept", "reject"]),
        note: z.string().trim().max(1000).optional(),
        guardianId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    return reviewKuanOrderImpl(supabase, userId, data);
  });

/**
 * Core implementation for reviewing pending payments/proofs.
 */
export async function reviewKuanPaymentImpl(
  supabase: any,
  userId: string,
  data: {
    id: string;
    action: "verify" | "reject";
    note?: string;
    guardianId?: string;
  },
): Promise<{ ok: boolean; status: string }> {
  const actor = await resolveReviewActor(supabase, userId, data.guardianId);

  const { data: entity, error: fetchError } = await supabase
    .from("kuanyin_payments")
    .select("id, status, user_id, metadata, appointment_id, order_id")
    .eq("id", data.id)
    .single();

  if (fetchError || !entity) {
    throw new Error("Comprovante não encontrado ou indisponível.");
  }

  const { data: entityGuardian, error: egError } = await supabase
    .from("kuanyin_guardians")
    .select("id, business_context_id")
    .eq("user_id", entity.user_id)
    .single();

  if (egError || !entityGuardian) {
    throw new Error("Não foi possível verificar a propriedade do comprovante.");
  }

  const targetStatus = data.action === "verify" ? "verified" : "rejected";

  // Validate transition
  validatePaymentTransition(entity.status, targetStatus, actor, entityGuardian.id);

  // Update row with metadata
  const existingMetadata =
    entity.metadata && typeof entity.metadata === "object" ? entity.metadata : {};
  const updatedMetadata = {
    ...existingMetadata,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    review_action: targetStatus,
    review_note: data.note || null,
  };

  const { data: updated, error: updateError } = await supabase
    .from("kuanyin_payments")
    .update({
      status: targetStatus,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", data.id)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    throw new Error("Falha ao atualizar o status do comprovante.");
  }

  // Write integrity log
  const logPayload = {
    actor_user_id: actor.actorUserId,
    guardian_id: actor.guardianId,
    entity_type: "payment",
    entity_id: data.id,
    from_status: entity.status,
    to_status: targetStatus,
    action: data.action,
    created_at: new Date().toISOString(),
  };

  await writeKuanIntegrityLog({
    supabase,
    userId: actor.actorUserId,
    category: "commercial_review",
    severity: "info",
    note: JSON.stringify(logPayload),
    excerpt: `reviewed_payment_action:${data.action} id:${data.id}`,
  });

  // Append public thread feedback if recoverable
  const threadId = (existingMetadata as any)?.thread_id || (existingMetadata as any)?.threadId;
  if (threadId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const feedbackMsg =
        data.action === "verify"
          ? "O Guardião conferiu o comprovante informado."
          : "O Guardião não conseguiu validar o comprovante informado. Verifique os dados e envie novamente.";

      await supabaseAdmin.from("kuanyin_public_chat_messages").insert({
        thread_id: threadId,
        guardian_id: entityGuardian.id,
        user_id: entity.user_id,
        role: "kuanyin",
        content: feedbackMsg,
      } as never);

      await supabaseAdmin
        .from("kuanyin_public_chat_threads")
        .update({ updated_at: new Date().toISOString() } as never)
        .eq("id", threadId);
    } catch (err) {
      console.error("Failed to append public chat feedback:", err);
    }
  }

  return { ok: true, status: updated.status };
}

/**
 * Reviews a pending payment.
 */
export const reviewKuanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["verify", "reject"]),
        note: z.string().trim().max(1000).optional(),
        guardianId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    return reviewKuanPaymentImpl(supabase, userId, data);
  });

/**
 * Backwards compatible helper for getPendingReviews.
 */
export const getPendingReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    return listKuanCommercialReviewItemsImpl(supabase, userId);
  });

/**
 * Backwards compatible helper for resolveReviewAction.
 */
export const resolveReviewAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum([
          "kuanyin.client.review",
          "kuanyin.appointment.review",
          "kuanyin.order.review",
          "kuanyin.payment.review",
        ]),
        action: z.enum(["confirm", "reject"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const defaultNewStatus = data.action === "confirm" ? "confirmed" : "rejected";

    let updated: { id: string; status: string } | null = null;
    let error: any = null;

    switch (data.type) {
      case "kuanyin.client.review": {
        // Try updating in client table first
        const clientRes = await supabase
          .from("kuanyin_clients")
          .update({ status: defaultNewStatus, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("id", data.id)
          .select("id, status");

        if (clientRes.data && clientRes.data.length > 0) {
          updated = clientRes.data[0];
          error = clientRes.error;
        } else {
          // Check if it's a message-based contact
          const { data: msgRow } = await supabase
            .from("kuanyin_public_chat_messages")
            .select("id")
            .eq("user_id", userId)
            .eq("id", data.id)
            .maybeSingle();

          if (msgRow) {
            updated = { id: data.id, status: defaultNewStatus };
          } else {
            error = new Error("Registro de contato não encontrado.");
          }
        }
        break;
      }
      case "kuanyin.appointment.review": {
        const actionMapped = data.action === "confirm" ? "confirm" : "reject";
        const res = await reviewKuanAppointmentImpl(supabase, userId, {
          id: data.id,
          action: actionMapped as "confirm" | "reject",
        });
        updated = { id: data.id, status: res.status };
        break;
      }
      case "kuanyin.order.review": {
        const actionMapped = data.action === "confirm" ? "accept" : "reject";
        const res = await reviewKuanOrderImpl(supabase, userId, {
          id: data.id,
          action: actionMapped as "accept" | "reject",
        });
        updated = { id: data.id, status: res.status };
        break;
      }
      case "kuanyin.payment.review": {
        const actionMapped = data.action === "confirm" ? "verify" : "reject";
        const res = await reviewKuanPaymentImpl(supabase, userId, {
          id: data.id,
          action: actionMapped as "verify" | "reject",
        });
        updated = { id: data.id, status: res.status };
        break;
      }
      default:
        throw new Error("Tipo de revisão inválido.");
    }

    if (error || !updated) {
      throw new Error(
        "Não foi possível resolver o item. Ele pode não existir ou já ter sido alterado.",
      );
    }

    return { ok: true, status: updated.status };
  });
