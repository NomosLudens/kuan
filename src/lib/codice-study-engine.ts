export const CODICE_TEXT_LIMIT = 80_000;
export const CODICE_MIN_TEXT_LENGTH = 20;

export type CodiceStudyResult = {
  documentId?: string;
  title?: string;
  summary: string;
  keyPoints: string[];
  concepts: Array<{
    term: string;
    explanation: string;
  }>;
  studyQuestions: string[];
  memoryCandidates: Array<{
    title: string;
    content: string;
    reason?: string;
    sensitivity?: "low" | "medium" | "high";
  }>;
  createdAt: string;
};

export function normalizeCodiceText(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, CODICE_TEXT_LIMIT);
}

export function validateCodiceText(raw: string) {
  const text = normalizeCodiceText(raw);
  if (!text) throw new Error("O documento está vazio.");
  if (text.length < CODICE_MIN_TEXT_LENGTH) {
    throw new Error("O documento é curto demais para fichamento.");
  }
  if (raw.length > CODICE_TEXT_LIMIT) {
    throw new Error("O texto é grande demais. Reduza para até 80.000 caracteres.");
  }
  return text;
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 16);
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

function firstWords(value: string, count: number) {
  return value.split(/\s+/).slice(0, count).join(" ");
}

function extractConceptCandidates(text: string) {
  const matches = text.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç-]{4,}\b/g) ?? [];
  return unique(matches, 6);
}

export function createCodiceStudyResult(input: {
  documentId?: string;
  title?: string;
  text: string;
  notes?: string[];
}): CodiceStudyResult {
  const text = validateCodiceText(input.text);
  const sentences = splitSentences(text);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const noteSentences = (input.notes ?? []).map((note) => note.trim()).filter(Boolean);

  const summary =
    sentences.length > 0
      ? `${sentences.slice(0, 4).join(" ")}${sentences.length > 4 ? "..." : ""}`
      : firstWords(text, 90);

  const keyPoints = unique(
    [
      ...paragraphs.map((paragraph) => firstWords(paragraph, 24)),
      ...sentences.filter((sentence) =>
        /importante|central|defende|tese|conceito|conclus[aã]o|portanto|assim/i.test(sentence),
      ),
      ...sentences.slice(0, 5),
    ].map((item) => item.replace(/[:;,.!?]+$/, "")),
    8,
  );

  const concepts = extractConceptCandidates(text).map((term) => {
    const sentence =
      sentences.find((item) => item.toLowerCase().includes(term.toLowerCase())) ?? summary;
    return {
      term,
      explanation: firstWords(sentence, 28),
    };
  });

  const studyQuestions = unique(
    [
      "Qual é a tese central deste texto?",
      "Quais conceitos precisam voltar para revisão?",
      "Que trecho merece virar margem ou hipótese de memória?",
      ...keyPoints.slice(0, 3).map((point) => `Como explicar com suas palavras: ${point}?`),
    ],
    6,
  );

  const candidateSources = unique([...noteSentences, ...keyPoints, ...sentences.slice(0, 3)], 6);

  return {
    documentId: input.documentId,
    title: input.title?.trim() || undefined,
    summary,
    keyPoints,
    concepts,
    studyQuestions,
    memoryCandidates: candidateSources.map((content, index) => ({
      title: noteSentences.includes(content)
        ? `Margem candidata ${index + 1}`
        : `Ideia candidata ${index + 1}`,
      content,
      reason: "Candidato gerado para revisão humana; não foi salvo no Jardim.",
      sensitivity: "medium",
    })),
    createdAt: new Date().toISOString(),
  };
}

export function formatCodiceStudyMarkdown(result: CodiceStudyResult) {
  return `# Fichamento${result.title ? ` - ${result.title}` : ""}

Gerado em: ${new Date(result.createdAt).toLocaleString("pt-BR")}

## Resumo

${result.summary}

## Pontos principais

${result.keyPoints.map((item) => `- ${item}`).join("\n") || "- Nenhum ponto explícito detectado."}

## Conceitos

${result.concepts.map((item) => `- **${item.term}:** ${item.explanation}`).join("\n") || "- Nenhum conceito destacado automaticamente."}

## Perguntas de estudo

${result.studyQuestions.map((item) => `- ${item}`).join("\n")}

## Candidatos à memória

${result.memoryCandidates.map((item) => `- **${item.title}:** ${item.content}`).join("\n") || "- Nenhum candidato gerado."}

> Nada foi salvo como memória durável. Estes itens precisam de revisão humana.`;
}
