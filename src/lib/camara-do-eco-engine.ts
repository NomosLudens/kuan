export const ECO_TEXT_LIMIT = 80_000;
export const ECO_MIN_TEXT_LENGTH = 20;

export type EcoMeetingResult = {
  title?: string;
  sourceText: string;
  cleanTranscript: string;
  summary: string;
  minutes: {
    context?: string;
    topics: string[];
    decisions: string[];
    pendingItems: Array<{
      task: string;
      owner?: string;
      dueDate?: string;
      priority?: "low" | "medium" | "high";
    }>;
  };
  memoryCandidates: Array<{
    title: string;
    content: string;
    reason?: string;
    sensitivity?: "low" | "medium" | "high";
  }>;
  createdAt: string;
};

export function normalizeMeetingText(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, ECO_TEXT_LIMIT);
}

export function validateMeetingText(raw: string) {
  const text = normalizeMeetingText(raw);
  if (!text) throw new Error("O texto está vazio.");
  if (text.length < ECO_MIN_TEXT_LENGTH) {
    throw new Error("O texto é curto demais para organizar uma ata.");
  }
  if (raw.length > ECO_TEXT_LIMIT) {
    throw new Error("O texto é grande demais. Reduza para até 80.000 caracteres.");
  }
  return text;
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 12);
}

function unique(items: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function sentenceIncludes(sentence: string, words: string[]) {
  const lower = sentence.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function firstWords(value: string, count: number) {
  return value.split(/\s+/).slice(0, count).join(" ");
}

function extractOwner(sentence: string) {
  const match = sentence.match(
    /\b(?:respons[aá]vel|com|ficou com|fica com|para)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç-]{1,40})/,
  );
  return match?.[1];
}

function extractDueDate(sentence: string) {
  const match = sentence.match(
    /\b(hoje|amanh[aã]|sexta|quinta|quarta|ter[cç]a|segunda|domingo|s[aá]bado|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|at[eé] [^.,;]+)/i,
  );
  return match?.[1];
}

function priorityFor(sentence: string): "low" | "medium" | "high" {
  if (sentenceIncludes(sentence, ["urgente", "crítico", "critico", "alta prioridade", "p1"])) {
    return "high";
  }
  if (sentenceIncludes(sentence, ["quando der", "baixa prioridade", "p3"])) return "low";
  return "medium";
}

export function processEcoMeetingText(input: {
  title?: string;
  sourceText: string;
}): EcoMeetingResult {
  const sourceText = validateMeetingText(input.sourceText);
  const sentences = splitSentences(sourceText);
  const paragraphs = sourceText
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const decisions = unique(
    sentences.filter((sentence) =>
      sentenceIncludes(sentence, [
        "decid",
        "defin",
        "aprov",
        "combin",
        "ficou acordado",
        "deliber",
        "vamos fazer",
      ]),
    ),
    8,
  );

  const pendingSentences = unique(
    sentences.filter((sentence) =>
      sentenceIncludes(sentence, [
        "pend",
        "tarefa",
        "próximo passo",
        "proximo passo",
        "precisa",
        "responsável",
        "responsavel",
        "prazo",
        "enviar",
        "validar",
        "preparar",
      ]),
    ),
    10,
  );

  const topics = unique(
    [...paragraphs.map((paragraph) => firstWords(paragraph, 16)), ...sentences.slice(0, 5)].map(
      (item) => item.replace(/[:;,.!?]+$/, ""),
    ),
    8,
  );

  const pendingItems = pendingSentences.map((sentence) => ({
    task: sentence,
    owner: extractOwner(sentence),
    dueDate: extractDueDate(sentence),
    priority: priorityFor(sentence),
  }));

  const memorySeeds = unique(
    [...decisions, ...pendingSentences, ...topics].filter((item) => item.length > 24),
    6,
  );

  const summary =
    sentences.length > 0
      ? `${sentences.slice(0, 3).join(" ")}${sentences.length > 3 ? "..." : ""}`
      : firstWords(sourceText, 70);

  return {
    title: input.title?.trim() || undefined,
    sourceText,
    cleanTranscript: sourceText,
    summary,
    minutes: {
      context: paragraphs[0] ? firstWords(paragraphs[0], 90) : undefined,
      topics,
      decisions,
      pendingItems,
    },
    memoryCandidates: memorySeeds.map((content, index) => ({
      title: decisions.includes(content)
        ? `Decisão detectada ${index + 1}`
        : pendingSentences.includes(content)
          ? `Pendência detectada ${index + 1}`
          : `Tema relevante ${index + 1}`,
      content,
      reason: "Candidato gerado para revisão humana; não foi salvo como memória durável.",
      sensitivity: "medium",
    })),
    createdAt: new Date().toISOString(),
  };
}

export function formatEcoResultMarkdown(result: EcoMeetingResult) {
  const pending = result.minutes.pendingItems.length
    ? result.minutes.pendingItems
        .map((item, index) => {
          const meta = [
            item.owner ? `responsável: ${item.owner}` : null,
            item.dueDate ? `prazo: ${item.dueDate}` : null,
            `prioridade: ${item.priority ?? "medium"}`,
          ]
            .filter(Boolean)
            .join("; ");
          return `${index + 1}. ${item.task}${meta ? ` (${meta})` : ""}`;
        })
        .join("\n")
    : "Nenhuma pendência explícita detectada.";

  return `# ${result.title || "Ata da Câmara do Eco"}

Gerado em: ${new Date(result.createdAt).toLocaleString("pt-BR")}

## Resumo

${result.summary}

## Tópicos

${result.minutes.topics.map((item) => `- ${item}`).join("\n") || "- Nenhum tópico explícito detectado."}

## Decisões

${result.minutes.decisions.map((item) => `- ${item}`).join("\n") || "- Nenhuma decisão explícita detectada."}

## Pendências

${pending}

## Candidatos à memória

${result.memoryCandidates.map((item) => `- **${item.title}:** ${item.content}`).join("\n") || "- Nenhum candidato gerado."}

> Nada foi salvo como memória durável. Estes itens precisam de revisão humana.`;
}
