// Motor do Corpore Sano — sincronização com Supabase.
//
// O estado de treino (exercícios, treino do dia, templates, plano semanal) é
// local-first e vive só no localStorage do cliente (kaline.treinos.v1). Só os
// pontos de sincronização — treino finalizado, sinais corporais e as leituras
// de histórico/PRs — passam pelo servidor.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_MODELS } from "@/lib/ai-models.server";
import { createOpenRouterProvider } from "@/lib/openrouter.server";
import { SEED_EXERCISES } from "@/features/treinos/data";

export type Semaphore = "green" | "yellow" | "red" | "blue" | "neutral";

// ────────────────────────────────────────────────────────────────────
// Sinais corporais
// ────────────────────────────────────────────────────────────────────
const SignalsInput = z.object({
  date: z.string(),
  energy: z.enum(["baixa", "media", "alta"]),
  sleep: z.enum(["ruim", "ok", "bom"]),
  pain: z.enum(["nenhuma", "leve", "relevante"]),
  available: z.union([z.literal(20), z.literal(40), z.literal(60)]),
  notes: z.string().max(2000).optional(),
});
export type SignalsPayload = z.infer<typeof SignalsInput>;

// ────────────────────────────────────────────────────────────────────
// Importação por texto livre → draft atual do Corpore Sano
// ────────────────────────────────────────────────────────────────────
const allowedExerciseIds = new Set(SEED_EXERCISES.map((e) => e.id));
const parseHits = new Map<string, number[]>();

const ParsedWorkoutInput = z.object({ text: z.string().trim().min(1).max(6000) });
const ParsedPlannedSet = z.object({
  set_number: z.number().int().positive(),
  target_reps: z.number().int().nonnegative(),
  target_weight: z.number().nonnegative().default(0),
  target_rir: z.number().int().nonnegative().optional(),
  rest_seconds: z.number().int().nonnegative().default(60),
});
const ParsedWorkout = z.object({
  unmatched: z.array(z.string().trim().min(1)).default([]),
  name: z.string().trim().min(1).max(160).default("Treino importado"),
  goal: z
    .enum(["forca", "hipertrofia", "resistencia", "mobilidade", "cardio"])
    .default("hipertrofia"),
  estimated_min: z.number().int().min(10).max(240).default(60),
  blocks: z
    .array(
      z.object({
        block_type: z
          .enum(["exercise", "superset", "warmup", "cardio", "mobility"])
          .default("exercise"),
        exercise_id: z.string().refine((id) => allowedExerciseIds.has(id)),
        planned: z.array(ParsedPlannedSet).min(1).max(20),
        logged: z.array(z.never()).default([]),
      }),
    )
    .min(1)
    .max(40),
});

function assertParseLimit(userId: string) {
  const now = Date.now();
  const recent = (parseHits.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) throw new Error("Tente novamente em instantes.");
  parseHits.set(userId, [...recent, now]);
}

function jsonFrom(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("JSON inválido");
    return JSON.parse(text.slice(start, end + 1));
  }
}

export const parseWorkoutTextTreino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ParsedWorkoutInput.parse(d))
  .handler(async ({ data, context }) => {
    assertParseLimit(context.userId);
    const gateway = createOpenRouterProvider();
    const schema = {
      name: "string",
      goal: "forca|hipertrofia|resistencia|mobilidade|cardio",
      estimated_min: "number",
      blocks: [
        {
          block_type: "exercise|superset|warmup|cardio|mobility",
          exercise_id: "um dos ids de exercicios aceitos",
          planned: [
            {
              set_number: "number",
              target_reps:
                "number; se houver faixa 8-12, use 8; se for até a falha sem número, use 0",
              target_weight: "number ou 0 se não informado",
              target_rir: "number opcional",
              rest_seconds: "number",
            },
          ],
          logged: [],
        },
      ],
      unmatched: ["nomes de exercícios citados que não estão na lista aceita"],
    };
    const exercises = SEED_EXERCISES.map(({ id, name, muscle_group, equipment, default_rest }) => ({
      id,
      name,
      muscle_group,
      equipment,
      default_rest,
    }));
    const system = `Você converte treinos escritos de forma confusa para a estrutura JSON aceita pelo app.

Regras obrigatórias:
- Não invente exercícios. Use somente IDs da lista de exercícios aceitos.
- Não invente cargas. Se não houver carga, use 0.
- Não invente séries. Se um exercício não tiver séries claras, não inclua esse exercício.
- Não invente repetições. Se não houver reps claras, use 0.
- Se houver faixa de repetições como 8-12 ou 10 a 15, use o menor número da faixa em target_reps.
- Se houver "até a falha" sem número, use 0.
- Se algum exercício citado não existir na lista aceita, não crie bloco para ele: informe o nome em unmatched.
- Não prescreva treino novo. Apenas organize o que foi informado.
- Preserve limitações importantes em nomes/notas gerais quando couber: dor, joelho, ombro, pouco tempo, preferência, restrição.
- Responda somente JSON válido.
- O JSON deve seguir exatamente o schema fornecido.`;
    const prompt = `Converta o treino abaixo para o schema do app.

Schema esperado:
${JSON.stringify(schema)}

Exercícios aceitos:
${JSON.stringify(exercises)}

Treino:
${data.text}`;
    const { text } = await generateText({
      // TODO: usar AI_MODELS.organizer quando a configuração central expor esse alias.
      model: gateway(AI_MODELS.chatFallback || AI_MODELS.chat),
      system,
      prompt,
      temperature: 0,
    });
    try {
      const parsed = ParsedWorkout.parse(jsonFrom(text));
      const { unmatched, ...workout } = parsed;
      return { workout, unmatched };
    } catch {
      throw new Error(
        "Não consegui transformar esse texto em treino. Tente deixar os exercícios um pouco mais separados.",
      );
    }
  });

export const persistSignalSnapshotTreino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignalsInput.parse(d))
  .handler(async ({ data, context }) => {
    const nota = JSON.stringify({
      energy: data.energy,
      sleep: data.sleep,
      pain: data.pain,
      available: data.available,
      notes: data.notes ?? null,
    });
    const rows = [
      {
        tipo: "energia" as const,
        intensidade: data.energy === "alta" ? 8 : data.energy === "media" ? 5 : 2,
      },
      {
        tipo: "sono" as const,
        intensidade: data.sleep === "bom" ? 8 : data.sleep === "ok" ? 5 : 2,
      },
      {
        tipo: "dor" as const,
        intensidade: data.pain === "relevante" ? 8 : data.pain === "leve" ? 4 : 0,
      },
      {
        tipo: "humor" as const,
        intensidade: data.energy === "alta" ? 8 : data.energy === "media" ? 5 : 3,
      },
      {
        tipo: "estresse" as const,
        intensidade: data.available === 20 ? 8 : data.available === 40 ? 5 : 2,
      },
    ].map((row) => ({ ...row, user_id: context.userId, nota }));

    const { error } = await context.supabase.from("corpo_sinais").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fetchLatestSignalTreino = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("corpo_sinais")
      .select("nota, registrado_em")
      .eq("user_id", context.userId)
      .eq("tipo", "energia")
      .order("registrado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.nota) return null;
    try {
      const parsed = JSON.parse(data.nota as string);
      return {
        date: String(data.registrado_em).slice(0, 10),
        energy: parsed.energy ?? "media",
        sleep: parsed.sleep ?? "ok",
        pain: parsed.pain ?? "nenhuma",
        available: (parsed.available ?? 40) as 20 | 40 | 60,
        notes: parsed.notes ?? undefined,
      };
    } catch {
      return null;
    }
  });

// ────────────────────────────────────────────────────────────────────
// Treino finalizado
// ────────────────────────────────────────────────────────────────────
const LoggedSetInput = z.object({
  set_number: z.number().int().positive(),
  weight: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  rir: z.number().optional(),
  rest_seconds: z.number().int().nonnegative(),
  status: z.enum(["pending", "completed", "skipped", "failed"]),
  logged_at: z.string(),
});

const FinishedBlockInput = z.object({
  exercise_id: z.string(),
  exercise_name: z.string().trim().min(1),
  muscle_group: z.string().trim().optional(),
  logged: z.array(LoggedSetInput),
});

const FinishWorkoutInput = z.object({
  name: z.string().trim().min(1).max(160),
  semaforo: z.enum(["green", "yellow", "red", "blue", "neutral"]),
  blocks: z.array(FinishedBlockInput),
});

export const persistFinishedWorkoutTreino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FinishWorkoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const startedAt =
      data.blocks.flatMap((b) => b.logged.map((l) => l.logged_at)).sort()[0] ??
      new Date().toISOString();
    const endedAt = new Date().toISOString();
    const duracao = Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
    );

    const { data: sessao, error: sessaoErr } = await supabase
      .from("treino_sessoes")
      .insert({
        user_id: userId,
        iniciada_em: startedAt,
        encerrada_em: endedAt,
        duracao_segundos: duracao,
        semaforo: data.semaforo,
        status: "concluida",
        notas: data.name,
      })
      .select("id")
      .single();
    if (sessaoErr || !sessao) throw new Error(sessaoErr?.message ?? "Não consegui criar a sessão.");

    for (let i = 0; i < data.blocks.length; i++) {
      const b = data.blocks[i];
      const { data: sx, error: sxErr } = await supabase
        .from("treino_sessao_exercicios")
        .insert({
          user_id: userId,
          sessao_id: sessao.id,
          nome: b.exercise_name,
          grupo_muscular: b.muscle_group || null,
          ordem: i,
        })
        .select("id")
        .single();
      if (sxErr || !sx) throw new Error(sxErr?.message ?? "Não consegui salvar o exercício.");

      const series = b.logged.map((l) => ({
        user_id: userId,
        sessao_exercicio_id: sx.id,
        ordem: l.set_number,
        peso: l.weight,
        reps: l.reps,
        rir: l.rir ?? null,
        descanso_segundos: l.rest_seconds,
        concluida: l.status === "completed",
        registrada_em: l.logged_at,
      }));
      if (series.length > 0) {
        const { error: seriesErr } = await supabase.from("treino_series").insert(series);
        if (seriesErr) throw new Error(seriesErr.message);
      }
    }

    return { ok: true, sessionId: sessao.id as string };
  });

// ────────────────────────────────────────────────────────────────────
// Histórico
// ────────────────────────────────────────────────────────────────────
export type HistoryItem = {
  id: string;
  date: string;
  name: string;
  totalSets: number;
  totalVolume: number;
  exerciseNames: string[];
};

const FetchHistoryInput = z.object({ limit: z.number().int().min(1).max(100).default(12) });

export const fetchHistoryTreino = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FetchHistoryInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { data: sessions, error } = await context.supabase
      .from("treino_sessoes")
      .select(
        "id, iniciada_em, notas, treino_sessao_exercicios(id, nome, treino_series(peso, reps, concluida))",
      )
      .eq("user_id", context.userId)
      .eq("status", "concluida")
      .order("iniciada_em", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!sessions) return [] as HistoryItem[];

    type SeriesRow = { peso: number | null; reps: number | null; concluida: boolean };
    type Row = {
      id: string;
      iniciada_em: string;
      notas: string | null;
      treino_sessao_exercicios:
        | {
            nome: string;
            treino_series: SeriesRow[] | null;
          }[]
        | null;
    };

    return (sessions as unknown as Row[]).map((s) => {
      const exs = s.treino_sessao_exercicios ?? [];
      const allSeries = exs.flatMap((e) => e.treino_series ?? []);
      const totalSets = allSeries.filter((x) => x.concluida).length;
      const totalVolume = allSeries.reduce(
        (acc, x) => acc + (x.concluida ? Number(x.peso ?? 0) * Number(x.reps ?? 0) : 0),
        0,
      );
      return {
        id: s.id,
        date: String(s.iniciada_em).slice(0, 10),
        name: s.notas ?? "Treino",
        totalSets,
        totalVolume,
        exerciseNames: exs.map((e) => e.nome),
      };
    });
  });

const WorkoutIdInput = z.object({ id: z.string().uuid() });

export const deleteWorkoutSessionTreino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WorkoutIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("treino_sessoes")
      .update({ status: "abandonada" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────
// Recordes pessoais (PR)
// ────────────────────────────────────────────────────────────────────
export type PRRecord = {
  exercise_name: string;
  weight: number;
  reps: number;
  e1rm: number; // estimativa Epley: peso * (1 + reps/30)
  date: string;
};

export const fetchPRsTreino = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("treino_sessao_exercicios")
      .select(
        "nome, treino_series(peso, reps, concluida, registrada_em), treino_sessoes(iniciada_em)",
      )
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (!data) return {} as Record<string, PRRecord>;

    type Row = {
      nome: string | null;
      treino_series:
        | { peso: number | null; reps: number | null; concluida: boolean; registrada_em: string }[]
        | null;
      treino_sessoes: { iniciada_em: string } | null;
    };

    const prs: Record<string, PRRecord> = {};
    for (const ex of data as unknown as Row[]) {
      const nome = String(ex.nome ?? "").trim();
      if (!nome) continue;
      const series = ex.treino_series ?? [];
      const sessaoStart = ex.treino_sessoes?.iniciada_em ?? null;
      for (const s of series) {
        if (!s.concluida) continue;
        const weight = Number(s.peso ?? 0);
        const reps = Number(s.reps ?? 0);
        if (weight <= 0 || reps <= 0) continue;
        const e1rm = weight * (1 + reps / 30);
        const when = String(s.registrada_em ?? sessaoStart ?? "").slice(0, 10);
        const prev = prs[nome];
        if (!prev || e1rm > prev.e1rm) {
          prs[nome] = { exercise_name: nome, weight, reps, e1rm, date: when };
        }
      }
    }
    return prs;
  });
