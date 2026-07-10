import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MicroappHost } from "@/components/microapps/MicroappHost";
import { CAMARA_MICROAPP_ACTIONS } from "@/components/microapps/microapp-events";
import type { MicroappEvent } from "@/components/microapps/microapp-types";
import { supabase } from "@/integrations/supabase/client";
import { authedFetch } from "@/lib/authed-fetch";
import { putBlob, getBlob, deleteBlob } from "@/lib/camara-blob-store";
import {
  analisarCamara,
  semearHipoteseCamara,
  criarRetornoKairos,
  listarSessoesCamara,
  criarSessaoCamara,
  finalizarSessaoCamara,
  deletarSessaoCamara,
  listarSegmentosCamara,
  criarSegmentoCamara,
  confirmarAudioPathCamara,
  type CamaraSegmento,
} from "@/lib/camara.functions";
import { useWakeLock } from "@/lib/use-wake-lock";

const SEGMENT_SECONDS = 180; // 3 minutos por bloco

const CAMARA_AUDIO_ERROR_MESSAGES = {
  unsupported:
    "Este navegador não oferece suporte confiável à gravação de áudio aqui. Tente Chrome, Edge ou outro navegador compatível.",
  insecure: "O microfone exige conexão segura. Abra o app em HTTPS.",
  denied:
    "Permissão de microfone negada. Libere o microfone nas configurações do navegador e tente novamente.",
  notFound: "Nenhum microfone foi encontrado neste dispositivo.",
  generic: "Não consegui iniciar a gravação. Verifique o microfone e tente novamente.",
} as const;

const RETRY_AUDIO_LOCAL_MISSING_MESSAGE =
  "O áudio local deste bloco não está mais disponível para reenvio. Se a transcrição não foi concluída, grave novamente este trecho.";
const RETRY_STORAGE_ONLY_MESSAGE =
  "Este bloco tem referência no Storage, mas o reenvio automático ainda não está disponível. Grave novamente ou tente processar outra sessão.";

function getCamaraAudioSupportError() {
  if (!window.isSecureContext) return CAMARA_AUDIO_ERROR_MESSAGES.insecure;
  if (!navigator.mediaDevices?.getUserMedia) return CAMARA_AUDIO_ERROR_MESSAGES.unsupported;
  if (typeof MediaRecorder === "undefined") return CAMARA_AUDIO_ERROR_MESSAGES.unsupported;
  return null;
}

function getCamaraStartErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return CAMARA_AUDIO_ERROR_MESSAGES.denied;
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return CAMARA_AUDIO_ERROR_MESSAGES.notFound;
    }
  }
  return CAMARA_AUDIO_ERROR_MESSAGES.generic;
}

type HostMessage = { source: "kaline-host"; action: string; payload?: unknown; timestamp: number };

function post(frame: HTMLIFrameElement | null, action: string, payload?: unknown) {
  frame?.contentWindow?.postMessage(
    { source: "kaline-host", action, payload, timestamp: Date.now() } satisfies HostMessage,
    window.location.origin,
  );
}

function record(payload: unknown) {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function CamaraHost() {
  const [recording, setRecording] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [pendingBlocks, setPendingBlocks] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const segTimerRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
  const ordemRef = useRef(0);
  const elapsedRef = useRef(0);
  const continueRef = useRef(true);
  const userIdRef = useRef<string | null>(null);
  const sessaoIdRef = useRef<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const listarSessoesFn = useServerFn(listarSessoesCamara);
  const criarSessaoFn = useServerFn(criarSessaoCamara);
  const deletarSessaoFn = useServerFn(deletarSessaoCamara);
  const listarSegmentosFn = useServerFn(listarSegmentosCamara);
  const criarSegmentoFn = useServerFn(criarSegmentoCamara);
  const confirmarAudioPathFn = useServerFn(confirmarAudioPathCamara);
  const finalizarSessaoFn = useServerFn(finalizarSessaoCamara);
  const analisarFn = useServerFn(analisarCamara);
  const semearFn = useServerFn(semearHipoteseCamara);
  const kairosFn = useServerFn(criarRetornoKairos);

  useWakeLock(recording || finalizing || pendingBlocks > 0);

  async function ensureUser() {
    if (userIdRef.current) return userIdRef.current;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("não logado");
    userIdRef.current = data.user.id;
    return data.user.id;
  }

  const enviarBloco = useCallback(
    async (frame: HTMLIFrameElement | null, sessaoId: string, seg: CamaraSegmento, blob: Blob) => {
      const processing: CamaraSegmento = { ...seg, status: "processing" };
      post(frame, "camara:segmento-atualizado", { segmento: processing });
      setPendingBlocks((n) => n + 1);
      try {
        const userId = await ensureUser();
        const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
        const path = `${userId}/${sessaoId}/${seg.id}.${ext}`;
        void supabase.storage
          .from("camara-audio")
          .upload(path, blob, { contentType: blob.type, upsert: true })
          .then((r) => {
            if (!r.error)
              void confirmarAudioPathFn({ data: { segmento_id: seg.id, audio_path: path } });
          });

        const form = new FormData();
        form.append("file", blob, `segmento.${ext}`);
        form.append("segmento_id", seg.id);
        const res = await authedFetch("/api/camara-transcribe-segment", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => "falha");
          post(frame, "camara:segmento-atualizado", {
            segmento: { ...seg, status: "failed", erro: msg },
          });
          toast.error(`Bloco ${seg.ordem}: ${msg.slice(0, 120)}`);
          return;
        }
        const { text } = (await res.json()) as { text: string };
        post(frame, "camara:segmento-atualizado", {
          segmento: { ...seg, status: "transcribed", transcricao: text },
        });
        await deleteBlob(seg.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro";
        post(frame, "camara:segmento-atualizado", {
          segmento: { ...seg, status: "failed", erro: msg },
        });
      } finally {
        setPendingBlocks((n) => Math.max(0, n - 1));
      }
    },
    [confirmarAudioPathFn],
  );

  const criarSegmentoEEnviar = useCallback(
    async (frame: HTMLIFrameElement | null, sessaoId: string, blob: Blob, ordem: number) => {
      const inicio = (ordem - 1) * SEGMENT_SECONDS;
      const fim =
        inicio +
        Math.round(
          blob.size > 0
            ? Math.min(SEGMENT_SECONDS, elapsedRef.current || SEGMENT_SECONDS)
            : SEGMENT_SECONDS,
        );
      let seg: CamaraSegmento;
      try {
        seg = await criarSegmentoFn({
          data: { sessao_id: sessaoId, ordem, inicio_seg: inicio, fim_seg: fim },
        });
      } catch {
        post(frame, "camara:error", { message: "Falha ao criar segmento" });
        return;
      }
      await putBlob(seg.id, blob);
      post(frame, "camara:segmento-criado", { segmento: seg });
      void enviarBloco(frame, sessaoId, seg, blob);
    },
    [criarSegmentoFn, enviarBloco],
  );

  const startRecorder = useCallback(
    (frame: HTMLIFrameElement | null, sessaoId: string) => {
      if (!streamRef.current || typeof MediaRecorder === "undefined") return;
      const mimeType =
        typeof MediaRecorder.isTypeSupported === "function"
          ? (["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "")
          : "";
      const rec = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        const ordem = ordemRef.current + 1;
        ordemRef.current = ordem;
        if (blob.size > 1024) void criarSegmentoEEnviar(frame, sessaoId, blob, ordem);
        if (continueRef.current) {
          elapsedRef.current = 0;
          startRecorder(frame, sessaoId);
        } else {
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
      rec.start();
      recRef.current = rec;
      segTimerRef.current = window.setTimeout(() => {
        if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
      }, SEGMENT_SECONDS * 1000);
    },
    [criarSegmentoEEnviar],
  );

  const startRecording = useCallback(
    async (frame: HTMLIFrameElement | null, sessaoId: string) => {
      // Guarda síncrona contra re-entrância: um segundo clique em "gravar" antes
      // do primeiro getUserMedia resolver criaria um segundo stream/ticker,
      // órfão do primeiro (nunca limpo).
      if (streamRef.current || sessaoIdRef.current) return;
      sessaoIdRef.current = sessaoId;
      const supportError = getCamaraAudioSupportError();
      if (supportError) {
        sessaoIdRef.current = null;
        post(frame, "camara:error", { message: supportError });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        continueRef.current = true;
        ordemRef.current = 0;
        elapsedRef.current = 0;
        setRecording(true);
        tickerRef.current = window.setInterval(() => {
          elapsedRef.current += 1;
          post(frame, "camara:record-tick", { sessao_id: sessaoId, elapsed: elapsedRef.current });
        }, 1000);
        startRecorder(frame, sessaoId);
      } catch (e) {
        sessaoIdRef.current = null;
        post(frame, "camara:error", { message: getCamaraStartErrorMessage(e) });
      }
    },
    [startRecorder],
  );

  const stopRecording = useCallback(
    async (frame: HTMLIFrameElement | null, sessaoId: string) => {
      continueRef.current = false;
      setRecording(false);
      setFinalizing(true);
      if (segTimerRef.current) {
        window.clearTimeout(segTimerRef.current);
        segTimerRef.current = null;
      }
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
      sessaoIdRef.current = null;
      try {
        await finalizarSessaoFn({ data: { sessao_id: sessaoId } });
        post(frame, "camara:sessao-finalizada", { sessao_id: sessaoId });
      } catch (e) {
        post(frame, "camara:error", {
          message: e instanceof Error ? e.message : "Não foi possível finalizar a câmara",
        });
      } finally {
        setFinalizing(false);
      }
    },
    [finalizarSessaoFn],
  );

  const handleEvent = useCallback(
    (event: MicroappEvent, frame: HTMLIFrameElement | null) => {
      frameRef.current = frame;
      if (event.source !== "camara-do-eco") return;

      void (async () => {
        try {
          const payload = record(event.payload);

          if (event.action === "camara:sessoes-request") {
            const sessoes = await listarSessoesFn();
            post(frame, "camara:sessoes-ready", { sessoes });
            return;
          }

          if (event.action === "camara:sessao-criar") {
            const modo = str(payload.modo) === "texto" ? "texto" : "audio";
            const sessao = await criarSessaoFn({
              data: {
                titulo: str(payload.titulo),
                modo,
                texto_rapido: modo === "texto" ? str(payload.texto_rapido) : undefined,
              },
            });
            post(frame, "camara:sessao-criada", { sessao });
            return;
          }

          if (event.action === "camara:sessao-abrir") {
            const sessaoId = str(payload.sessao_id);
            const segmentos = await listarSegmentosFn({ data: { sessao_id: sessaoId } });
            post(frame, "camara:sessao-aberta", { sessao_id: sessaoId, segmentos });
            return;
          }

          if (event.action === "camara:sessao-deletar") {
            const sessaoId = str(payload.sessao_id);
            await deletarSessaoFn({ data: { sessao_id: sessaoId } });
            post(frame, "camara:sessao-deletada", { sessao_id: sessaoId });
            return;
          }

          if (event.action === "camara:record-start") {
            await startRecording(frame, str(payload.sessao_id));
            return;
          }

          if (event.action === "camara:record-stop") {
            await stopRecording(frame, str(payload.sessao_id));
            return;
          }

          if (event.action === "camara:bloco-retry") {
            const sessaoId = str(payload.sessao_id);
            const segmentoId = str(payload.segmento_id);
            const audioPath = payload.audio_path;
            const blob = await getBlob(segmentoId);
            if (!blob) {
              const msg = audioPath
                ? RETRY_STORAGE_ONLY_MESSAGE
                : RETRY_AUDIO_LOCAL_MISSING_MESSAGE;
              post(frame, "camara:segmento-atualizado", {
                segmento: { id: segmentoId, status: "failed", erro: msg },
              });
              return;
            }
            const seg: CamaraSegmento = {
              id: segmentoId,
              sessao_id: sessaoId,
              ordem: Number(payload.ordem ?? 0),
              inicio_seg: Number(payload.inicio_seg ?? 0),
              fim_seg: Number(payload.fim_seg ?? 0),
              audio_path: typeof audioPath === "string" ? audioPath : null,
              transcricao: null,
              status: "queued",
              erro: null,
            };
            void enviarBloco(frame, sessaoId, seg, blob);
            return;
          }

          if (event.action === "camara:analisar") {
            const sessaoId = str(payload.sessao_id);
            const analise = await analisarFn({ data: { sessao_id: sessaoId } });
            post(frame, "camara:analise-pronta", { sessao_id: sessaoId, analise });
            return;
          }

          if (event.action === "camara:semear") {
            const res = await semearFn({
              data: {
                sessao_id: str(payload.sessao_id),
                title: str(payload.title),
                body: str(payload.body),
                origem: str(payload.origem, "manual") as
                  | "decisao"
                  | "proximo_gesto"
                  | "sinal"
                  | "candidato_revisao"
                  | "tema"
                  | "manual",
              },
            });
            post(frame, "camara:hipotese-semeada", res);
            toast.success("Hipótese semeada na Revisão de hoje.");
            return;
          }

          if (event.action === "camara:kairos-criar") {
            const res = await kairosFn({
              data: {
                sessao_id: str(payload.sessao_id),
                titulo: str(payload.titulo),
                descricao: payload.descricao ? str(payload.descricao) : undefined,
                inicio: str(payload.inicio),
                fim: payload.fim ? str(payload.fim) : undefined,
                tipo: str(payload.tipo, "compromisso") as
                  | "compromisso"
                  | "prazo"
                  | "reuniao"
                  | "evento"
                  | "aula"
                  | "outro",
              },
            });
            post(frame, "camara:kairos-criado", res);
            toast.success("Retorno Kairós criado na agenda.");
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha na Câmara do Eco.";
          post(frame, "camara:error", { message });
          toast.error(message);
        }
      })();
    },
    [
      analisarFn,
      criarSessaoFn,
      deletarSessaoFn,
      enviarBloco,
      kairosFn,
      listarSegmentosFn,
      listarSessoesFn,
      semearFn,
      startRecording,
      stopRecording,
    ],
  );

  // Sem isso, sair da rota da Câmara enquanto uma gravação está em andamento
  // deixava o microfone ativo e blocos continuavam sendo criados/enviados em
  // segundo plano fora da tela.
  useEffect(() => {
    return () => {
      if (segTimerRef.current) window.clearTimeout(segTimerRef.current);
      if (tickerRef.current) window.clearInterval(tickerRef.current);
      if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      sessaoIdRef.current = null;
    };
  }, []);

  return (
    <MicroappHost
      appId="camara-do-eco"
      title="Câmara do Eco"
      expectedSource="camara-do-eco"
      allowedActions={CAMARA_MICROAPP_ACTIONS}
      loadingLabel="Abrindo Câmara do Eco..."
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
      onEvent={handleEvent}
    />
  );
}
