import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const kinds = [
  "nota",
  "evento",
  "sentimento",
  "ideia",
  "dor",
  "ganho",
  "sonho",
  "pergunta",
] as const;

const CreateSchema = z.object({
  kind: z.enum(kinds),
  body: z.string().trim().min(1).max(8000),
  mood: z.number().int().min(-3).max(3).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  occurred_at: z.string().datetime().optional(),
});

const ListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  kind: z.enum(kinds).optional(),
  since: z.string().datetime().optional(),
});

export const createRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof CreateSchema>) => CreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("registro_vivo")
      .insert({
        user_id: userId,
        kind: data.kind,
        body: data.body,
        mood: data.mood ?? null,
        tags: data.tags ?? [],
        occurred_at: data.occurred_at ?? new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listRegistros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof ListSchema>) => ListSchema.parse(data))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("registro_vivo")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.since) q = q.gte("occurred_at", data.since);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("registro_vivo").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
