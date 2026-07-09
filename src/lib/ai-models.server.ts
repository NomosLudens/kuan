import { CHAT_MODELS } from "./chat-models";

export const AI_MODELS = {
  chat:
    process.env.OPENROUTER_CHAT_MODEL ||
    process.env.OPENROUTER_TEXT_MODEL_PRIMARY ||
    process.env.OPENROUTER_MODEL_PRIMARY ||
    process.env.OPENROUTER_MODEL ||
    CHAT_MODELS[0],
  // Acionado automaticamente (via fetch wrapper em openrouter.server.ts) quando
  // a chamada ao modelo de chat primário falha antes do streaming começar.
  chatFallback: process.env.OPENROUTER_CHAT_MODEL_FALLBACK || CHAT_MODELS[1],
  fast:
    process.env.OPENROUTER_FAST_MODEL ||
    process.env.OPENROUTER_TRIAGE_MODEL ||
    process.env.OPENROUTER_TEXT_MODEL_FALLBACK_2 ||
    "openai/gpt-4o-mini",
  reasoning:
    process.env.OPENROUTER_REASONING_MODEL ||
    process.env.OPENROUTER_TEXT_MODEL_FALLBACK_1 ||
    process.env.OPENROUTER_MODEL_FALLBACK_2 ||
    "openai/gpt-4o",
  vision:
    process.env.OPENROUTER_VISION_MODEL_PRIMARY ||
    process.env.KUANYIN_IMAGE_READING_MODEL ||
    "openai/gpt-4o-mini",
  // Leitura nativa de documentos (PDF). Gemini lê PDF anexado de fato, ao
  // contrário do modelo de chat texto-only. Env-overridável.
  documents:
    process.env.OPENROUTER_PDF_MODEL ||
    process.env.OPENROUTER_DOCUMENT_MODEL ||
    "google/gemini-2.5-flash",
  tts: process.env.OPENROUTER_TTS_MODEL || process.env.OPENROUTER_TTS_PRIMARY_MODEL || "",
  ttsVoice: process.env.OPENROUTER_TTS_VOICE || "",
} as const;
