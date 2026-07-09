import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ModoSchema = z.enum(["jurisprudencia", "legislacao"]);

const Input = z.object({
  query: z.string().min(3),
  modo: ModoSchema,
});

export const pesquisarJuridico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    // Imports server-only dinâmicos: este módulo é referenciado por rotas de
    // cliente via RPC, então import estático de `*.server.*` quebra o build.
    const { createOpenRouterProvider } = await import("@/lib/openrouter.server");
    const { AI_MODELS } = await import("@/lib/ai-models.server");
    let gateway: ReturnType<typeof createOpenRouterProvider>;
    try {
      gateway = createOpenRouterProvider();
    } catch (err) {
      console.error("AI provider configuration error", err instanceof Error ? err.message : err);
      throw new Error("A IA ainda não está configurada neste ambiente.");
    }

    const system =
      data.modo === "jurisprudencia"
        ? `Você é um pesquisador jurídico. Pesquise jurisprudência brasileira (STF, STJ, TST, TJs) sobre o tema. SEMPRE cite tribunal, número do processo/acórdão e link de fonte oficial. Se não houver fonte confiável que você conheça, responda APENAS: "SEM_FONTE". Formato: markdown com seções "Tese", "Fundamento", "Fonte".`
        : `Você é um pesquisador de legislação brasileira. Indique lei, artigo, inciso e parágrafo aplicáveis, com link do Planalto. Se não souber com certeza, responda APENAS: "SEM_FONTE". Formato: markdown com seções "Dispositivo", "Texto", "Fonte".`;

    const { text } = await generateText({
      model: gateway(AI_MODELS.reasoning),
      system,
      prompt: data.query,
    });

    const semFonte = text.trim().toUpperCase().startsWith("SEM_FONTE");
    return {
      query: data.query,
      modo: data.modo,
      resultado: semFonte ? null : text,
      aviso: semFonte
        ? "Não encontrei fonte normativa/jurisprudencial confiável para esse tema. Posso ajudar com organização conceitual."
        : null,
    };
  });

export type AcervoItem = {
  id: string;
  titulo: string | null;
  texto: string | null;
  created_at: string;
};

export const listarAcervoJuridico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ modo: ModoSchema }).parse(d))
  .handler(async ({ data, context }): Promise<AcervoItem[]> => {
    if (data.modo === "jurisprudencia") {
      const { data: rows, error } = await context.supabase
        .from("jurisprudencia")
        .select("id, ementa, conteudo, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows ?? []).map((r) => ({
        id: r.id,
        titulo: r.ementa,
        texto: r.conteudo,
        created_at: r.created_at,
      }));
    }
    const { data: rows, error } = await context.supabase
      .from("legislacao")
      .select("id, titulo, texto, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SalvarAcervoSchema = z.object({
  modo: ModoSchema,
  titulo: z.string().trim().min(1).max(300),
  texto: z.string().trim().min(1),
});

export const salvarAcervoJuridico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SalvarAcervoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } =
      data.modo === "jurisprudencia"
        ? await context.supabase
            .from("jurisprudencia")
            .insert({ user_id: context.userId, ementa: data.titulo, conteudo: data.texto })
        : await context.supabase
            .from("legislacao")
            .insert({ user_id: context.userId, titulo: data.titulo, texto: data.texto });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const removerAcervoJuridico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ modo: ModoSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const table = data.modo === "jurisprudencia" ? "jurisprudencia" : "legislacao";
    const { error } = await context.supabase
      .from(table)
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
