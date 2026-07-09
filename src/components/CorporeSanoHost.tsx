import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MicroappHost } from "@/components/microapps/MicroappHost";
import { CORPORE_SANO_MICROAPP_ACTIONS } from "@/components/microapps/microapp-events";
import type { MicroappEvent } from "@/components/microapps/microapp-types";
import { ensureThread } from "@/lib/ensure-thread";
import {
  deleteWorkoutSessionTreino,
  fetchHistoryTreino,
  fetchLatestSignalTreino,
  fetchPRsTreino,
  parseWorkoutTextTreino,
  persistFinishedWorkoutTreino,
  persistSignalSnapshotTreino,
  type Semaphore,
} from "@/lib/treinos.functions";

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

export function CorporeSanoHost() {
  const navigate = useNavigate();
  const fetchHistoryFn = useServerFn(fetchHistoryTreino);
  const fetchLatestSignalFn = useServerFn(fetchLatestSignalTreino);
  const fetchPRsFn = useServerFn(fetchPRsTreino);
  const parseWorkoutTextFn = useServerFn(parseWorkoutTextTreino);
  const persistFinishedWorkoutFn = useServerFn(persistFinishedWorkoutTreino);
  const persistSignalSnapshotFn = useServerFn(persistSignalSnapshotTreino);
  const deleteWorkoutSessionFn = useServerFn(deleteWorkoutSessionTreino);

  const handleEvent = useCallback(
    (event: MicroappEvent, frame: HTMLIFrameElement | null) => {
      if (event.source !== "corpore-sano") return;

      void (async () => {
        try {
          const payload = record(event.payload);

          if (event.action === "corpore-sano:sync-request") {
            const [history, signal, prs] = await Promise.all([
              fetchHistoryFn({ data: { limit: 12 } }),
              fetchLatestSignalFn(),
              fetchPRsFn(),
            ]);
            post(frame, "corpore-sano:sync-ready", { history, signal, prs });
            return;
          }

          if (event.action === "corpore-sano:parse-workout-text") {
            const workout = await parseWorkoutTextFn({ data: { text: str(payload.text) } });
            post(frame, "corpore-sano:workout-text-parsed", workout);
            return;
          }

          if (event.action === "corpore-sano:finish-workout") {
            await persistFinishedWorkoutFn({
              data: {
                name: str(payload.name),
                semaforo: str(payload.semaforo, "neutral") as Semaphore,
                blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
              },
            });
            const [history, prs] = await Promise.all([
              fetchHistoryFn({ data: { limit: 12 } }),
              fetchPRsFn(),
            ]);
            post(frame, "corpore-sano:workout-finished", { history, prs });
            toast.success("Treino salvo.");
            return;
          }

          if (event.action === "corpore-sano:signals-save") {
            await persistSignalSnapshotFn({
              data: {
                date: str(payload.date),
                energy: str(payload.energy, "media") as "baixa" | "media" | "alta",
                sleep: str(payload.sleep, "ok") as "ruim" | "ok" | "bom",
                pain: str(payload.pain, "nenhuma") as "nenhuma" | "leve" | "relevante",
                available: Number(payload.available ?? 40) as 20 | 40 | 60,
                notes: payload.notes ? str(payload.notes) : undefined,
              },
            });
            post(frame, "corpore-sano:signals-saved", {});
            return;
          }

          if (event.action === "corpore-sano:history-delete") {
            const id = str(payload.id);
            await deleteWorkoutSessionFn({ data: { id } });
            const history = await fetchHistoryFn({ data: { limit: 12 } });
            post(frame, "corpore-sano:history-deleted", { history });
            return;
          }

          if (event.action === "corpore-sano:khora-chat-open") {
            const seed = str(payload.seed);
            const id = await ensureThread("kaline");
            if (!id) {
              post(frame, "corpore-sano:error", {
                message: "Entre na sua conta para conversar com a Khora.",
              });
              return;
            }
            await navigate({
              to: "/chat/$threadId",
              params: { threadId: id },
              search: { seed, facet: "khora", domain: "training" },
            });
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha no Corpore Sano.";
          post(frame, "corpore-sano:error", { message });
          toast.error(message);
        }
      })();
    },
    [
      deleteWorkoutSessionFn,
      fetchHistoryFn,
      fetchLatestSignalFn,
      fetchPRsFn,
      navigate,
      parseWorkoutTextFn,
      persistFinishedWorkoutFn,
      persistSignalSnapshotFn,
    ],
  );

  return (
    <MicroappHost
      appId="corpore-sano"
      title="Corpore Sano"
      expectedSource="corpore-sano"
      allowedActions={CORPORE_SANO_MICROAPP_ACTIONS}
      loadingLabel="Abrindo Corpore Sano..."
      onEvent={handleEvent}
    />
  );
}
