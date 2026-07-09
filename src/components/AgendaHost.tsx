import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MicroappHost } from "@/components/microapps/MicroappHost";
import { AGENDA_MICROAPP_ACTIONS } from "@/components/microapps/microapp-events";
import type { MicroappEvent } from "@/components/microapps/microapp-types";
import {
  listarEventosAgenda,
  criarEventoAgenda,
  atualizarEventoAgenda,
  deletarEventoAgenda,
  type TipoEvento,
} from "@/lib/agenda.functions";

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
  return typeof value === "string" && value ? value : null;
}

const TIPOS_VALIDOS: TipoEvento[] = ["compromisso", "aula", "reuniao", "evento", "prazo", "outro"];
function tipoEvento(value: unknown): TipoEvento {
  return TIPOS_VALIDOS.includes(value as TipoEvento) ? (value as TipoEvento) : "compromisso";
}

export function AgendaHost() {
  const listarFn = useServerFn(listarEventosAgenda);
  const criarFn = useServerFn(criarEventoAgenda);
  const atualizarFn = useServerFn(atualizarEventoAgenda);
  const deletarFn = useServerFn(deletarEventoAgenda);

  const handleEvent = useCallback(
    (event: MicroappEvent, frame: HTMLIFrameElement | null) => {
      if (event.source !== "agenda") return;

      void (async () => {
        try {
          const payload = record(event.payload);

          if (event.action === "agenda:eventos-request") {
            const eventos = await listarFn({
              data: { inicio: str(payload.inicio), fim: str(payload.fim) },
            });
            // Ecoa o requestId: navegação rápida entre meses dispara vários
            // requests em sequência; sem isso, uma resposta atrasada de um
            // mês antigo podia sobrescrever o mês atualmente exibido.
            post(frame, "agenda:eventos-ready", { eventos, requestId: payload.requestId });
            return;
          }

          if (event.action === "agenda:evento-criar") {
            const evento = await criarFn({
              data: {
                titulo: str(payload.titulo),
                tipo: tipoEvento(payload.tipo),
                inicio: str(payload.inicio),
                fim: optionalStr(payload.fim),
                local: optionalStr(payload.local),
                descricao: optionalStr(payload.descricao),
              },
            });
            post(frame, "agenda:evento-criado", { evento });
            toast.success("Evento criado");
            return;
          }

          if (event.action === "agenda:evento-atualizar") {
            const evento = await atualizarFn({
              data: {
                id: str(payload.id),
                titulo: str(payload.titulo),
                tipo: tipoEvento(payload.tipo),
                inicio: str(payload.inicio),
                fim: optionalStr(payload.fim),
                local: optionalStr(payload.local),
                descricao: optionalStr(payload.descricao),
              },
            });
            post(frame, "agenda:evento-atualizado", { evento });
            toast.success("Evento atualizado");
            return;
          }

          if (event.action === "agenda:evento-deletar") {
            const id = str(payload.id);
            await deletarFn({ data: { id } });
            post(frame, "agenda:evento-deletado", { id });
            toast.success("Evento removido");
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha na Agenda.";
          post(frame, "agenda:error", { message });
          toast.error(message);
        }
      })();
    },
    [atualizarFn, criarFn, deletarFn, listarFn],
  );

  return (
    <MicroappHost
      appId="agenda"
      title="Agenda"
      expectedSource="agenda"
      allowedActions={AGENDA_MICROAPP_ACTIONS}
      loadingLabel="Abrindo Agenda..."
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
      onEvent={handleEvent}
    />
  );
}
