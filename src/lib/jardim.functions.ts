import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// SM-2 simplificado para repetição espaçada.
// quality: 0 (errei), 1 (difícil), 2 (ok), 3 (fácil) — mapeado de botões de revisão.
function nextSchedule(
  prev: { ease: number; interval_days: number; review_count: number },
  quality: 0 | 1 | 2 | 3,
) {
  let { ease, interval_days, review_count } = prev;
  // ease entre 1.3 e 2.8
  ease = Math.max(1.3, Math.min(2.8, ease + (0.1 - (3 - quality) * 0.08)));
  if (quality === 0) {
    interval_days = 1;
    review_count = 0;
  } else if (review_count === 0) {
    interval_days = quality >= 2 ? 1 : 1;
  } else if (review_count === 1) {
    interval_days = quality >= 2 ? 3 : 1;
  } else {
    interval_days = Math.max(1, Math.round(interval_days * ease));
  }
  return {
    ease,
    interval_days,
    review_count: review_count + 1,
    next_review_at: new Date(Date.now() + interval_days * 86_400_000).toISOString(),
    last_reviewed_at: new Date().toISOString(),
  };
}

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(8000),
  source: z.string().trim().max(60).optional(),
  source_ref: z.string().uuid().optional(),
  category: z.string().trim().min(1).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  importance: z.number().int().min(1).max(3).optional(),
});

export const createMemoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof CreateSchema>) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("jardim_memorias")
      .insert({
        user_id: context.userId,
        title: data.title,
        body: data.body,
        source: data.source ?? null,
        source_ref: data.source_ref ?? null,
        category: data.category ?? "geral",
        tags: data.tags ?? [],
        importance: data.importance ?? 2,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMemorias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { archived?: boolean; limit?: number; category?: string }) =>
    z
      .object({
        archived: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        category: z.string().trim().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("jardim_memorias")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    q = data.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const dueMemorias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("jardim_memorias")
      .select("*")
      .is("archived_at", null)
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(data.limit ?? 20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const reviewMemoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; quality: 0 | 1 | 2 | 3 }) =>
    z.object({ id: z.string().uuid(), quality: z.number().int().min(0).max(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: prev, error: e1 } = await context.supabase
      .from("jardim_memorias")
      .select("ease, interval_days, review_count")
      .eq("id", data.id)
      .single();
    if (e1 || !prev) throw new Error(e1?.message ?? "not_found");
    const next = nextSchedule(
      {
        ease: Number(prev.ease),
        interval_days: prev.interval_days,
        review_count: prev.review_count,
      },
      data.quality as 0 | 1 | 2 | 3,
    );
    const { error } = await context.supabase.from("jardim_memorias").update(next).eq("id", data.id);
    if (error) throw new Error(error.message);
    return next;
  });

export const archiveMemoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; archive: boolean }) =>
    z.object({ id: z.string().uuid(), archive: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("jardim_memorias")
      .update({ archived_at: data.archive ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
