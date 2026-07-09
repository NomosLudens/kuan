import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  formatEcoResultMarkdown,
  processEcoMeetingText,
  type EcoMeetingResult,
} from "@/lib/camara-do-eco-engine";

const PendingItemSchema = z.object({
  task: z.string(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const MemoryCandidateSchema = z.object({
  title: z.string(),
  content: z.string(),
  reason: z.string().optional(),
  sensitivity: z.enum(["low", "medium", "high"]).optional(),
});

const EcoResultSchema = z.object({
  title: z.string().optional(),
  sourceText: z.string(),
  cleanTranscript: z.string(),
  summary: z.string(),
  minutes: z.object({
    context: z.string().optional(),
    topics: z.array(z.string()).default([]),
    decisions: z.array(z.string()).default([]),
    pendingItems: z.array(PendingItemSchema).default([]),
  }),
  memoryCandidates: z.array(MemoryCandidateSchema).default([]),
  createdAt: z.string(),
});

const ProcessInput = z.object({
  title: z.string().trim().max(160).optional(),
  sourceText: z.string(),
});

const ECO_SYSTEM = `Você é a Câmara do Eco da Kaline. Transforme uma reunião/transcrição em estrutura fiel.

Regras:
- Não invente decisão, responsável ou prazo.
- Se algo for inferência, deixe claro no texto.
- Candidatos à memória são apenas candidatos para revisão humana.
- Não escreva que algo foi salvo no Jardim.
- Use português brasileiro e devolva apenas JSON conforme o schema.`;

async function aiEcoResult(input: z.infer<typeof ProcessInput>): Promise<EcoMeetingResult> {
  const { createOpenRouterProvider } = await import("@/lib/openrouter.server");
  const { AI_MODELS } = await import("@/lib/ai-models.server");
  const gateway = createOpenRouterProvider();
  const sourceText = input.sourceText.slice(0, 60_000);

  const { experimental_output } = await generateText({
    model: gateway(AI_MODELS.reasoning),
    system: ECO_SYSTEM,
    prompt: `Título opcional: ${input.title || "sem título"}\n\nTranscrição/conteúdo:\n\n${sourceText}`,
    experimental_output: Output.object({ schema: EcoResultSchema }),
    temperature: 0.2,
    maxOutputTokens: 5000,
  });

  return {
    ...experimental_output,
    title: experimental_output.title || input.title,
    sourceText,
    createdAt: experimental_output.createdAt || new Date().toISOString(),
  };
}

export const processarCamaraDoEco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProcessInput.parse(data))
  .handler(async ({ data, context }) => {
    let result: EcoMeetingResult;

    try {
      result = await aiEcoResult(data);
    } catch (err) {
      console.warn(
        "Câmara do Eco: IA indisponível, usando fallback determinístico",
        err instanceof Error ? err.message : err,
      );
      result = processEcoMeetingText(data);
    }

    const { data: row, error } = await context.supabase
      .from("camara_sessoes")
      .insert({
        user_id: context.userId,
        titulo: result.title || "Câmara do Eco",
        modo: "texto",
        status: "finalizado",
        texto_rapido: result.sourceText,
        analise: result,
        analise_at: result.createdAt,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const candidates = result.memoryCandidates.slice(0, 8).map((candidate) => ({
      user_id: context.userId,
      domain: "memory",
      source: "camara-do-eco",
      source_id: row.id,
      title: candidate.title,
      content: candidate.content,
      reason: candidate.reason ?? "Gerado pela Câmara do Eco a partir de reunião/transcrição.",
      sensitivity: candidate.sensitivity ?? "medium",
      metadata: {
        meetingTitle: result.title ?? null,
        generatedAt: result.createdAt,
      },
    }));

    if (candidates.length) {
      const { error: candidateError } = await (context.supabase as SupabaseClient)
        .from("memory_candidates")
        .insert(candidates);
      if (candidateError) throw new Error(candidateError.message);
    }

    return {
      sessionId: row.id,
      result,
      markdown: formatEcoResultMarkdown(result),
    };
  });
