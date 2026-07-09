import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createCodiceStudyResult,
  formatCodiceStudyMarkdown,
  type CodiceStudyResult,
} from "@/lib/codice-study-engine";

const ConceptSchema = z.object({
  term: z.string(),
  explanation: z.string(),
});

const MemoryCandidateSchema = z.object({
  title: z.string(),
  content: z.string(),
  reason: z.string().optional(),
  sensitivity: z.enum(["low", "medium", "high"]).optional(),
});

const CodiceStudySchema = z.object({
  documentId: z.string().optional(),
  title: z.string().optional(),
  summary: z.string(),
  keyPoints: z.array(z.string()).default([]),
  concepts: z.array(ConceptSchema).default([]),
  studyQuestions: z.array(z.string()).default([]),
  memoryCandidates: z.array(MemoryCandidateSchema).default([]),
  createdAt: z.string(),
});

const StudyInput = z.object({
  documentId: z.string().uuid().optional(),
  title: z.string().trim().max(180).optional(),
  text: z.string(),
  notes: z.array(z.string()).max(20).optional(),
});

const CODICE_SYSTEM = `Você é o Códice da Klio dentro de Kháris. Gere fichamento estruturado e fiel ao texto.

Regras:
- Não invente fatos, autores ou conceitos.
- Use notas/margens como contexto do leitor, sem tratá-las como verdade do texto.
- Candidatos à memória são apenas candidatos para revisão humana.
- Não escreva que algo foi salvo no Jardim.
- Use português brasileiro e devolva apenas JSON conforme o schema.`;

async function aiCodiceStudy(input: z.infer<typeof StudyInput>): Promise<CodiceStudyResult> {
  const { createOpenRouterProvider } = await import("@/lib/openrouter.server");
  const { AI_MODELS } = await import("@/lib/ai-models.server");
  const gateway = createOpenRouterProvider();
  const text = input.text.slice(0, 60_000);

  const { experimental_output } = await generateText({
    model: gateway(AI_MODELS.reasoning),
    system: CODICE_SYSTEM,
    prompt: `Documento: ${input.title || "sem título"}\n\nMargens do leitor:\n${
      (input.notes ?? []).map((note) => `- ${note}`).join("\n") || "- sem margens"
    }\n\nTexto:\n\n${text}`,
    experimental_output: Output.object({ schema: CodiceStudySchema }),
    temperature: 0.25,
    maxOutputTokens: 5000,
  });

  return {
    ...experimental_output,
    documentId: input.documentId,
    title: experimental_output.title || input.title,
    createdAt: experimental_output.createdAt || new Date().toISOString(),
  };
}

export const gerarFichamentoCodice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StudyInput.parse(data))
  .handler(async ({ data, context }) => {
    let notes = data.notes ?? [];

    if (data.documentId && notes.length === 0) {
      const { data: margemRows } = await context.supabase
        .from("codice_margens")
        .select("nota")
        .eq("livro_id", data.documentId)
        .order("created_at", { ascending: false })
        .limit(20);
      notes = (margemRows ?? []).map((row) => row.nota).filter(Boolean);
    }

    let result: CodiceStudyResult;

    try {
      result = await aiCodiceStudy({ ...data, notes });
    } catch (err) {
      console.warn(
        "Códice: IA indisponível, usando fallback determinístico",
        err instanceof Error ? err.message : err,
      );
      result = createCodiceStudyResult({ ...data, notes });
    }

    const markdown = formatCodiceStudyMarkdown(result);

    if (data.documentId) {
      const { error } = await context.supabase
        .from("livros")
        .update({
          resumo: markdown,
          ultimo_acesso_em: new Date().toISOString(),
        })
        .eq("id", data.documentId);
      if (error) throw new Error(error.message);
    }

    const candidates = result.memoryCandidates.slice(0, 8).map((candidate) => ({
      user_id: context.userId,
      domain: "kharis",
      source: "codice",
      source_id: data.documentId ?? null,
      title: candidate.title,
      content: candidate.content,
      reason: candidate.reason ?? "Gerado pelo Códice a partir de leitura/fichamento.",
      sensitivity: candidate.sensitivity ?? "medium",
      metadata: {
        documentTitle: result.title ?? data.title ?? null,
        generatedAt: result.createdAt,
      },
    }));

    if (candidates.length) {
      const { error: candidateError } = await (context.supabase as SupabaseClient)
        .from("memory_candidates")
        .insert(candidates);
      if (candidateError) throw new Error(candidateError.message);
    }

    return { result, markdown };
  });
