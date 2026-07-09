import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MicroappHost } from "@/components/microapps/MicroappHost";
import { JURIDICO_MICROAPP_ACTIONS } from "@/components/microapps/microapp-events";
import type { MicroappEvent } from "@/components/microapps/microapp-types";
import { useAuthz } from "@/lib/use-authz";
import {
  addLegalChunks,
  listLegalChunks,
  listLegalDocuments,
  searchLegal,
  upsertLegalDocument,
} from "@/lib/legal.functions";

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

function optionalStr(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function num(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

export function JuridicoHost() {
  const authz = useAuthz();
  const listDocsFn = useServerFn(listLegalDocuments);
  const searchFn = useServerFn(searchLegal);
  const upsertDocFn = useServerFn(upsertLegalDocument);
  const addChunksFn = useServerFn(addLegalChunks);
  const listChunksFn = useServerFn(listLegalChunks);

  const handleEvent = useCallback(
    (event: MicroappEvent, frame: HTMLIFrameElement | null) => {
      if (event.source !== "juridico") return;

      void (async () => {
        try {
          const payload = record(event.payload);

          if (event.action === "juridico:documentos-request") {
            const docs = await listDocsFn({ data: {} });
            post(frame, "juridico:documentos-pronto", { docs, isAdmin: authz.isAdmin });
            return;
          }

          if (event.action === "juridico:busca-request") {
            const results = await searchFn({
              data: {
                query: str(payload.query),
                document_id: optionalStr(payload.document_id),
                limit: num(payload.limit),
              },
            });
            // Ecoa requestId: sem isso, uma busca antiga que demora mais que
            // uma busca mais nova sobrescreve o resultado exibido.
            post(frame, "juridico:busca-pronto", { results, requestId: payload.requestId });
            return;
          }

          if (event.action === "juridico:documento-salvar") {
            await upsertDocFn({
              data: {
                kind: payload.kind as never,
                title: str(payload.title),
                slug: str(payload.slug),
                ano: typeof payload.ano === "number" ? payload.ano : null,
                numero: optionalStr(payload.numero),
                status: payload.status as never,
                source_url: optionalStr(payload.source_url) ?? null,
              },
            });
            const docs = await listDocsFn({ data: {} });
            post(frame, "juridico:documento-salvo", { docs });
            toast.success("Documento salvo");
            return;
          }

          if (event.action === "juridico:trechos-salvar") {
            const chunksInput = Array.isArray(payload.chunks) ? payload.chunks : [];
            const result = await addChunksFn({
              data: {
                document_id: str(payload.document_id),
                chunks: chunksInput as never,
                replace: Boolean(payload.replace),
              },
            });
            post(frame, "juridico:trechos-salvo", result);
            toast.success(`${result.inserted} trechos importados`);
            return;
          }

          if (event.action === "juridico:trechos-request") {
            const chunks = await listChunksFn({ data: { document_id: str(payload.document_id) } });
            post(frame, "juridico:trechos-pronto", { chunks });
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha no Jurídico.";
          post(frame, "juridico:erro", { message });
          toast.error(message);
        }
      })();
    },
    [addChunksFn, authz.isAdmin, listChunksFn, listDocsFn, searchFn, upsertDocFn],
  );

  return (
    <MicroappHost
      appId="juridico"
      title="Jurídico"
      expectedSource="juridico"
      allowedActions={JURIDICO_MICROAPP_ACTIONS}
      loadingLabel="Abrindo o Jurídico..."
      onEvent={handleEvent}
    />
  );
}
