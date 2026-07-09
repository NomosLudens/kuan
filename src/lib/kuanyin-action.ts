import { z } from "zod";

export const KuanyinActionSchema = z.union([
  z.object({
    type: z.literal("kuanyin.client.create"),
    summary: z.string().trim().min(1),
    data: z
      .object({
        nome: z.string().trim().min(1).optional(),
        client_name: z.string().trim().min(1).optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        notas: z.string().optional(),
      })
      .refine((d) => Boolean(d.nome || d.client_name), "nome ou client_name obrigatório"),
  }),
  z.object({
    type: z.literal("kuanyin.appointment.propose"),
    summary: z.string().trim().min(1),
    data: z.object({
      service_name: z.string().trim().min(1),
      starts_at: z.string().trim().min(1),
      client_id: z.string().optional(),
      client_name: z.string().optional(),
      client_phone: z.string().optional(),
      client_email: z.string().optional(),
      ends_at: z.string().optional().nullable(),
      price_cents: z.number().int().nonnegative().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  }),
  z.object({
    type: z.literal("kuanyin.order.propose"),
    summary: z.string().trim().min(1),
    data: z.object({
      description: z.string().trim().min(1),
      client_id: z.string().optional(),
      client_name: z.string().optional(),
      client_phone: z.string().optional(),
      client_email: z.string().optional(),
      items: z.array(z.unknown()).optional(),
      price_cents: z.number().int().nonnegative().optional().nullable(),
    }),
  }),
  z.object({
    type: z.literal("kuanyin.payment.proof"),
    summary: z.string().trim().min(1),
    data: z
      .object({
        order_id: z.string().optional().nullable(),
        appointment_id: z.string().optional().nullable(),
        amount_cents: z.number().int().positive(),
        method: z.string().optional().nullable(),
        comprovante_ref: z.string().optional().nullable(),
        fraud_alert_note: z.string().optional().nullable(),
      })
      .refine(
        (d) => Boolean(d.order_id || d.appointment_id),
        "order_id ou appointment_id obrigatório",
      ),
  }),
]);

export type KuanyinActionBlock = z.infer<typeof KuanyinActionSchema>;

export const KUANYIN_ACTION_FENCE_RE = /```kuanyin-action\s*\n([\s\S]*?)\n```/g;

export function extractKuanyinActions(text: string): {
  clean: string;
  actions: KuanyinActionBlock[];
  invalidCount: number;
} {
  const actions: KuanyinActionBlock[] = [];
  let invalidCount = 0;
  const clean = text
    .replace(KUANYIN_ACTION_FENCE_RE, (_m, body: string) => {
      if (actions.length > 0) {
        invalidCount += 1;
        return "";
      }
      try {
        const parsed = KuanyinActionSchema.safeParse(JSON.parse(body));
        if (parsed.success) actions.push(parsed.data);
        else invalidCount += 1;
      } catch {
        invalidCount += 1;
      }
      return "";
    })
    .trim();
  return { clean, actions, invalidCount };
}

export function extractActions(text: string): { clean: string; actions: KuanyinActionBlock[] } {
  const parsed = extractKuanyinActions(text);
  return {
    clean:
      parsed.invalidCount > 0
        ? `${parsed.clean}\n\n[ação estruturada inválida descartada por segurança]`.trim()
        : parsed.clean,
    actions: parsed.actions,
  };
}
