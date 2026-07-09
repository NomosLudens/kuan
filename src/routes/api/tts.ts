// TTS via OpenRouter — Kaline fala.
// A OpenRouter devolve o áudio como bytes crus numa resposta única;
// repassamos direto ao cliente, que decodifica e toca via AudioContext.
//
// Requer provider de voz configurado no runtime. Se ausente, responde 503 amigável.
import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user.server";
import { rateLimit } from "@/lib/rate-limit";

const MAX_INPUT_CHARS = 4000;
const DEFAULT_MODEL = "google/gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Vindemiatrix";
// Acionado se o modelo primário falhar — Kokoro/dora era o default antigo e
// continua como a voz segura de fallback.
const FALLBACK_MODEL = process.env.OPENROUTER_TTS_FALLBACK_MODEL || "hexgrad/kokoro-82m";
const FALLBACK_VOICE = process.env.OPENROUTER_TTS_FALLBACK_VOICE || "pf_dora";
const isGeminiTts = (model: string) => model.startsWith("google/gemini-") && model.includes("tts");

// Gemini 3.1 Flash TTS entrega PCM cru a 24 kHz / 16-bit mono — o navegador não
// decodifica PCM sem cabeçalho, então envelopamos num container WAV (44 bytes de
// header) antes de devolver ao cliente.
const GEMINI_PCM_SAMPLE_RATE = 24000;
const GEMINI_PCM_BITS = 16;
const GEMINI_PCM_CHANNELS = 1;

function isRawPcmContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const t = contentType.toLowerCase();
  return (
    t.includes("audio/pcm") ||
    t.includes("audio/l16") ||
    t.includes("application/octet-stream") ||
    t.includes("audio/x-raw")
  );
}

function pcmToWav(
  pcm: ArrayBuffer,
  opts: { sampleRate: number; bitsPerSample: number; channels: number },
): ArrayBuffer {
  const { sampleRate, bitsPerSample, channels } = opts;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // subchunk1 size (PCM)
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(pcm));
  return buffer;
}

type Body = {
  text?: unknown;
  voice?: unknown;
  model?: unknown;
  speed?: unknown;
};

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("error" in auth) return auth.error;
        const limited = rateLimit(auth.userId, "tts", 60, 60);
        if (limited) return limited;

        const key = process.env.OPENROUTER_API_KEY;
        if (!key) {
          return Response.json(
            {
              error: "ai_not_configured",
              message: "A voz da Kaline ainda não está configurada neste ambiente.",
            },
            { status: 503 },
          );
        }

        let payload: Body;
        try {
          payload = (await request.json()) as Body;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const text = typeof payload.text === "string" ? payload.text.trim() : "";
        if (!text) return new Response("text obrigatório", { status: 400 });
        if (text.length > MAX_INPUT_CHARS) {
          return new Response(
            `text excede ${MAX_INPUT_CHARS} caracteres — quebre em chunks no cliente`,
            { status: 413 },
          );
        }

        const voice =
          (typeof payload.voice === "string" && payload.voice) ||
          process.env.OPENROUTER_TTS_VOICE ||
          DEFAULT_VOICE;
        const model =
          (typeof payload.model === "string" && payload.model) ||
          process.env.OPENROUTER_TTS_MODEL ||
          process.env.OPENROUTER_TTS_PRIMARY_MODEL ||
          DEFAULT_MODEL;
        const speed =
          typeof payload.speed === "number" && Number.isFinite(payload.speed)
            ? Math.min(1.2, Math.max(0.75, payload.speed))
            : undefined;

        const rawReferer =
          request.headers.get("origin") ||
          process.env.OPENROUTER_SITE_URL ||
          process.env.APP_PUBLIC_URL ||
          "https://kaline.app";
        const referer = (() => {
          try {
            const url = new URL(rawReferer);
            return `${url.protocol}//${url.host}`;
          } catch {
            return "https://kaline.app";
          }
        })();

        // A OpenRouter devolve bytes de áudio crus (não SSE); para Gemini mantemos
        // o formato nativo, e para os demais pedimos mp3 quando suportado.
        async function callSpeech(useModel: string, useVoice: string): Promise<Response> {
          const speechBody: Record<string, unknown> = {
            model: useModel,
            voice: useVoice,
            input: text,
          };
          // O endpoint /audio/speech é compatível com a OpenAI, cujo response_format
          // default é "mp3". O Gemini TTS só emite PCM (24 kHz/16-bit mono) e NÃO gera
          // mp3 — omitir o campo aplicava o default mp3 e derrubava a chamada, caindo
          // no Kokoro. Pedimos "pcm" explicitamente (formato nativo garantido) e
          // envelopamos em WAV na volta. Demais modelos continuam em mp3.
          speechBody.response_format = isGeminiTts(useModel) ? "pcm" : "mp3";
          if (speed && !isGeminiTts(useModel)) speechBody.speed = speed;
          return fetch("https://openrouter.ai/api/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              "HTTP-Referer": referer,
              "X-Title": process.env.OPENROUTER_APP_NAME ?? "Kaline Totalidade",
            },
            body: JSON.stringify(speechBody),
            signal: request.signal,
          });
        }

        let finalModel = model;
        let finalVoice = voice;
        // Motivo da queda ao fallback — exposto ao cliente para o Guardião
        // enxergar por que o modelo primário falhou, em vez de virar Kokoro em silêncio.
        let fallbackReason: string | null = null;
        let upstream: Response;
        try {
          upstream = await callSpeech(finalModel, finalVoice);
        } catch (err) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          const msg = err instanceof Error ? err.message : "erro de rede";
          return new Response(msg, { status: 502 });
        }

        // Acionado se o modelo primário falhar — evita retry inútil quando quem
        // já pediu explicitamente o Kokoro também falha.
        if (!upstream.ok && finalModel !== FALLBACK_MODEL) {
          const errBody = await upstream.text().catch(() => "");
          fallbackReason = `${finalModel} HTTP ${upstream.status}: ${errBody}`.slice(0, 180);
          console.warn(
            "TTS primário falhou, tentando fallback",
            finalModel,
            "->",
            FALLBACK_MODEL,
            upstream.status,
            errBody,
          );
          finalModel = FALLBACK_MODEL;
          finalVoice = FALLBACK_VOICE;
          try {
            upstream = await callSpeech(finalModel, finalVoice);
          } catch (err) {
            if (request.signal.aborted) return new Response(null, { status: 499 });
            const msg = err instanceof Error ? err.message : "erro de rede";
            return new Response(msg, { status: 502 });
          }
        }

        if (!upstream.ok) {
          const errBody = await upstream.text().catch(() => "");
          console.error("TTS upstream error", upstream.status, errBody);
          return new Response("Não foi possível gerar o áudio agora. Tente novamente.", {
            status: upstream.status,
          });
        }

        const upstreamContentType = upstream.headers.get("content-type");
        const headers: Record<string, string> = {
          "Cache-Control": "no-cache",
          "X-TTS-Voice": finalVoice,
          "X-TTS-Model": finalModel,
        };
        if (fallbackReason) {
          headers["X-TTS-Fallback"] = "1";
          headers["X-TTS-Fallback-Reason"] = fallbackReason;
        }

        // Gemini devolve PCM cru — envelopamos em WAV para o navegador tocar.
        if (isGeminiTts(finalModel) || isRawPcmContentType(upstreamContentType)) {
          const pcm = await upstream.arrayBuffer();
          const wav = pcmToWav(pcm, {
            sampleRate: GEMINI_PCM_SAMPLE_RATE,
            bitsPerSample: GEMINI_PCM_BITS,
            channels: GEMINI_PCM_CHANNELS,
          });
          headers["Content-Type"] = "audio/wav";
          return new Response(wav, { headers });
        }

        headers["Content-Type"] = upstreamContentType || "audio/mpeg";
        return new Response(upstream.body, { headers });
      },
    },
  },
});
