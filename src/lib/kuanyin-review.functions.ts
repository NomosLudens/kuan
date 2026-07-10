import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeKuanIntegrityLog } from "@/lib/kuanyin-integrity";
import { z } from "zod";

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

export const getPendingReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;

    const [clientsRes, appointmentsRes, ordersRes, paymentsRes] = await Promise.all([
      supabase
        .from("kuanyin_clients")
        .select("id, nome, email, telefone, status, created_at")
        .eq("user_id", userId)
        .in("status", ["pending", "proposed"]),
      supabase
        .from("kuanyin_appointments")
        .select("id, service_name, starts_at, price_cents, status, created_at")
        .eq("user_id", userId)
        .eq("status", "proposed"),
      supabase
        .from("kuanyin_orders")
        .select("id, description, price_cents, status, created_at")
        .eq("user_id", userId)
        .eq("status", "proposed"),
      supabase
        .from("kuanyin_payments")
        .select("id, amount_cents, method, status, created_at")
        .eq("user_id", userId)
        .in("status", ["received_proof", "pending_review"]),
    ]);

    const items: ReviewItem[] = [];

    if (clientsRes.data) {
      for (const c of clientsRes.data) {
        items.push({
          id: c.id,
          type: "kuanyin.client.review",
          title: c.nome,
          details: `Email: ${c.email || "-"} | Tel: ${c.telefone || "-"}`,
          status: c.status,
          createdAt: c.created_at,
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
          title: `Pagamento via ${p.method || "Desconhecido"}`,
          details: `Valor: ${val}`,
          status: p.status,
          createdAt: p.created_at,
        });
      }
    }

    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return items;
  });

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
    const newStatus = data.action === "confirm" ? "confirmed" : "rejected";

    let updated: { id: string; status: string } | null = null;
    let error: any = null;

    switch (data.type) {
      case "kuanyin.client.review": {
        const res = await supabase
          .from("kuanyin_clients")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("id", data.id)
          .select("id, status")
          .single();
        updated = res.data;
        error = res.error;
        break;
      }
      case "kuanyin.appointment.review": {
        const res = await supabase
          .from("kuanyin_appointments")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("id", data.id)
          .select("id, status")
          .single();
        updated = res.data;
        error = res.error;
        break;
      }
      case "kuanyin.order.review": {
        const res = await supabase
          .from("kuanyin_orders")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("id", data.id)
          .select("id, status")
          .single();
        updated = res.data;
        error = res.error;
        break;
      }
      case "kuanyin.payment.review": {
        const res = await supabase
          .from("kuanyin_payments")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("id", data.id)
          .select("id, status")
          .single();
        updated = res.data;
        error = res.error;
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

    await writeKuanIntegrityLog({
      supabase,
      userId,
      category: "review_action_resolved",
      note: `${data.type} ${data.action}`,
      excerpt: `entity_id:${data.id}`,
    });

    return { ok: true, status: updated.status };
  });
