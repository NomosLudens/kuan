import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AI_MODELS } from "@/lib/ai-models.server";
import { isChatModel } from "@/lib/chat-models";

export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return key;
}

// Se a chamada de chat com o modelo primário falhar antes do streaming começar
// (modelo inválido, 429, 5xx imediato), refaz a mesma requisição trocando só o
// `model` pelo fallback configurado. Não afeta os outros papéis (fast/reasoning/
// vision/documents) porque só age quando o `model` do corpo é AI_MODELS.chat.
// Falha depois que o stream já começou (200 OK) não é coberta.
function withChatFallback(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const bodyText = init?.body;
    if (typeof bodyText !== "string") return baseFetch(input, init);

    let parsed: { model?: string } & Record<string, unknown>;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return baseFetch(input, init);
    }
    if (
      (parsed.model !== AI_MODELS.chat && !isChatModel(parsed.model)) ||
      parsed.model === AI_MODELS.chatFallback
    ) {
      return baseFetch(input, init);
    }

    const res = await baseFetch(input, init);
    if (res.ok) return res;

    console.warn(
      "OpenRouter chat model falhou, tentando fallback",
      AI_MODELS.chat,
      "->",
      AI_MODELS.chatFallback,
      res.status,
    );
    return baseFetch(input, {
      ...init,
      body: JSON.stringify({ ...parsed, model: AI_MODELS.chatFallback }),
    });
  };
}

export function createOpenRouterProvider() {
  return createOpenAICompatible({
    name: "openrouter",
    apiKey: getOpenRouterApiKey(),
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ??
        process.env.APP_PUBLIC_URL ??
        "https://kaline-totalidade.local",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Kaline Totalidade",
    },
    fetch: withChatFallback(fetch),
  });
}
