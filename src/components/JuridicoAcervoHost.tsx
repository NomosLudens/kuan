import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MicroappHost } from "@/components/microapps/MicroappHost";
import { JURIDICO_ACERVO_MICROAPP_ACTIONS } from "@/components/microapps/microapp-events";
import type { MicroappEvent } from "@/components/microapps/microapp-types";
import {
  listarAcervoJuridico,
  pesquisarJuridico,
  removerAcervoJuridico,
  salvarAcervoJuridico,
} from "@/lib/juridico.functions";

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

type Modo = "legislacao" | "jurisprudencia";

export function JuridicoAcervoHost({ modo }: { modo: Modo }) {
  const pesquisarFn = useServerFn(pesquisarJuridico);
  const listarFn = useServerFn(listarAcervoJuridico);
  const salvarFn = useServerFn(salvarAcervoJuridico);
  const removerFn = useServerFn(removerAcervoJuridico);

  const handleEvent = useCallback(
    (event: MicroappEvent, frame: HTMLIFrameElement | null) => {
      if (event.source !== "juridico-acervo") return;

      void (async () => {
        try {
          const payload = record(event.payload);

          if (event.action === "juridico-acervo:itens-request") {
            const itens = await listarFn({ data: { modo } });
            post(frame, "juridico-acervo:itens-ready", { itens });
            return;
          }

          if (event.action === "juridico-acervo:buscar") {
            const resultado = await pesquisarFn({ data: { query: str(payload.query), modo } });
            post(frame, "juridico-acervo:resultado", resultado);
            return;
          }

          if (event.action === "juridico-acervo:salvar") {
            await salvarFn({
              data: { modo, titulo: str(payload.titulo), texto: str(payload.texto) },
            });
            const itens = await listarFn({ data: { modo } });
            post(frame, "juridico-acervo:salvo", { itens });
            toast.success("Salvo no acervo");
            return;
          }

          if (event.action === "juridico-acervo:remover") {
            await removerFn({ data: { modo, id: str(payload.id) } });
            const itens = await listarFn({ data: { modo } });
            post(frame, "juridico-acervo:removido", { itens });
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha no acervo jurídico.";
          post(frame, "juridico-acervo:error", { message });
          toast.error(message);
        }
      })();
    },
    [listarFn, modo, pesquisarFn, removerFn, salvarFn],
  );

  return (
    <MicroappHost
      appId={modo}
      title={modo === "jurisprudencia" ? "Jurisprudência" : "Legislação"}
      expectedSource="juridico-acervo"
      allowedActions={JURIDICO_ACERVO_MICROAPP_ACTIONS}
      loadingLabel="Abrindo..."
      onEvent={handleEvent}
    />
  );
}
