// Contexto externo: o usuário cola markdown com contexto de outros apps/conversas
// e Kaline passa a ler como diretriz adicional (até `ativo = false` ou apagado).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_CONTEUDO = 60_000;

const createSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  conteudo: z.string().trim().min(1).max(MAX_CONTEUDO),
});

const toggleSchema = z.object({
  id: z.string().uuid(),
  ativo: z.boolean(),
});

const idSchema = z.object({ id: z.string().uuid() });

export const listarContextos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("contexto_externo" as never)
      .select("id, titulo, conteudo, ativo, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      titulo: string;
      conteudo: string;
      ativo: boolean;
      created_at: string;
      updated_at: string;
    }>;
  });

export const criarContexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("contexto_externo" as never)
      .insert({ user_id: userId, titulo: data.titulo, conteudo: data.conteudo } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Falha ao salvar");
    return { id: (row as { id: string }).id };
  });

export const toggleContexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => toggleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("contexto_externo" as never)
      .update({ ativo: data.ativo, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const apagarContexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("contexto_externo" as never)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
