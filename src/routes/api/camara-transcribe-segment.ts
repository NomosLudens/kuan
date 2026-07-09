// Rota servidor: recebe um blob de segmento (até 3 min) da Câmara de Eco,
// usa o mesmo caminho de transcrição do chat e atualiza camara_segmentos.
import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user.server";
import { rateLimit } from "@/lib/rate-limit";
import { isAllowedAudioType, transcribeAudioBlob } from "@/lib/transcribe.server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export const Route = createFileRoute("/api/camara-transcribe-segment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireUser(request);
        if ("error" in auth) return auth.error;
        const limited = rateLimit(auth.userId, "camara-transcribe", 30, 60);
        if (limited) return limited;

        const inForm = await request.formData();
        const file = inForm.get("file");
        const segmentoId = inForm.get("segmento_id");
        if (!(file instanceof Blob) || typeof segmentoId !== "string") {
          return new Response("file e segmento_id obrigatórios", { status: 400 });
        }
        if (file.size > MAX_AUDIO_BYTES) return new Response("file too large", { status: 413 });
        const baseType = file.type.split(";")[0];
        if (baseType && !isAllowedAudioType(baseType)) {
          return new Response(`unsupported media type: ${baseType}`, { status: 415 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Verifica propriedade do segmento
        const { data: seg, error: segErr } = await supabaseAdmin
          .from("camara_segmentos")
          .select("id, user_id")
          .eq("id", segmentoId)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (segErr || !seg) return new Response("segmento não encontrado", { status: 404 });
        if (seg.user_id !== auth.userId) return new Response("Forbidden", { status: 403 });

        await supabaseAdmin
          .from("camara_segmentos")
          .update({ status: "processing", erro: null })
          .eq("id", segmentoId)
          .eq("user_id", auth.userId);

        let text = "";
        try {
          text = await transcribeAudioBlob(file, baseType || "audio/webm");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "erro de transcrição";
          const status =
            err instanceof Error && err.name === "TranscriptionNotConfiguredError" ? 503 : 502;
          await supabaseAdmin
            .from("camara_segmentos")
            .update({ status: "failed", erro: msg.slice(0, 500) })
            .eq("id", segmentoId)
            .eq("user_id", auth.userId);
          return new Response(msg.slice(0, 300), { status });
        }

        await supabaseAdmin
          .from("camara_segmentos")
          .update({ status: "transcribed", transcricao: text, erro: null })
          .eq("id", segmentoId)
          .eq("user_id", auth.userId);

        return Response.json({ text });
      },
    },
  },
});
