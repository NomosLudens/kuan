import { isSTTModel } from "./stt-models";
const ALLOWED_AUDIO_FORMATS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
};

export function audioFormatFor(mediaType: string): string | null {
  const baseType = mediaType.split(";")[0];
  if (!baseType) return "webm";
  return ALLOWED_AUDIO_FORMATS[baseType] ?? null;
}

export function isAllowedAudioType(mediaType: string): boolean {
  return audioFormatFor(mediaType) !== null;
}

export async function transcribeAudioBlob(
  file: Blob,
  mediaType: string,
  configuredModel?: unknown,
  configuredFallbackModel?: unknown,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    const err = new Error("A IA ainda não está configurada neste ambiente.");
    err.name = "TranscriptionNotConfiguredError";
    throw err;
  }

  const format = audioFormatFor(mediaType);
  if (!format) {
    const err = new Error(`unsupported media type: ${mediaType}`);
    err.name = "UnsupportedAudioTypeError";
    throw err;
  }

  // "-turbo" prioriza velocidade e tem WER mais alto que a versão completa,
  // principalmente fora do inglês — troca por qualidade em vez de latência.
  const model =
    (isSTTModel(configuredModel) && configuredModel) ||
    (isSTTModel(process.env.OPENROUTER_TRANSCRIBE_MODEL) &&
      process.env.OPENROUTER_TRANSCRIBE_MODEL) ||
    (isSTTModel(process.env.OPENROUTER_STT_PRIMARY_MODEL) &&
      process.env.OPENROUTER_STT_PRIMARY_MODEL) ||
    "google/gemini-2.5-flash-lite";
  // Acionado se o modelo primário falhar — protege contra instabilidade de um
  // modelo recém-lançado no endpoint de transcrição.
  const fallbackModel =
    (isSTTModel(configuredFallbackModel) && configuredFallbackModel) ||
    (isSTTModel(process.env.OPENROUTER_STT_FALLBACK_MODEL) &&
      process.env.OPENROUTER_STT_FALLBACK_MODEL) ||
    "openai/whisper-large-v3";
  const audioData = Buffer.from(await file.arrayBuffer()).toString("base64");

  async function callTranscription(useModel: string): Promise<Response> {
    return fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL ??
          process.env.APP_PUBLIC_URL ??
          "https://kaline-totalidade.local",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Kaline Totalidade",
      },
      body: JSON.stringify({
        model: useModel,
        input_audio: { data: audioData, format },
        language: process.env.KALINE_STT_LANGUAGE || "pt",
        temperature: 0,
      }),
    });
  }

  let res = await callTranscription(model);
  if (!res.ok && model !== fallbackModel) {
    const errBody = await res.text().catch(() => "");
    console.warn(
      "STT primário falhou, tentando fallback",
      model,
      "->",
      fallbackModel,
      res.status,
      errBody,
    );
    res = await callTranscription(fallbackModel);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("Transcription upstream error", res.status, errBody);
    const err = new Error("Não foi possível transcrever o áudio agora. Tente novamente.");
    err.name = "TranscriptionUpstreamError";
    throw err;
  }

  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

const REVISAO_SYSTEM = `Você revisa transcrições de fala em português do Brasil.
Corrija APENAS: pontuação, capitalização, espaçamento e erros óbvios de reconhecimento de voz (homófonos, palavras coladas ou partidas).
PRESERVE 100% do sentido e das palavras do falante — não resuma, não parafraseie, não acrescente nem remova ideias, não traduza.
NÃO responda ao conteúdo nem comente: devolva somente o texto revisado, sem aspas e sem rótulos.`;

// Passa o texto bruto do Whisper por um modelo rápido para limpar pontuação e
// erros óbvios de audição, sem alterar o sentido. Em qualquer falha devolve o
// texto original — a revisão nunca pode bloquear o ditado.
export async function revisarTranscricaoTexto(raw: string): Promise<string> {
  const limpo = raw.trim();
  if (limpo.length < 2) return limpo;
  try {
    const { generateText } = await import("ai");
    const { createOpenRouterProvider } = await import("@/lib/openrouter.server");
    const { AI_MODELS } = await import("@/lib/ai-models.server");
    const gateway = createOpenRouterProvider();
    const { text } = await generateText({
      model: gateway(AI_MODELS.fast),
      system: REVISAO_SYSTEM,
      prompt: limpo,
      temperature: 0.2,
      maxOutputTokens: Math.min(2000, Math.ceil(limpo.length / 2) + 200),
    });
    const revisado = text.trim();
    return revisado || limpo;
  } catch (err) {
    console.warn("Revisão de transcrição falhou", err instanceof Error ? err.message : err);
    return limpo;
  }
}
