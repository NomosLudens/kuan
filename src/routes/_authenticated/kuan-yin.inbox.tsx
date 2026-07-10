import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listGuardianInboxThreads,
  getGuardianInboxThread,
  sendGuardianManualReply,
  setGuardianThreadStatus,
} from "@/lib/kuanyin-inbox.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan-yin/inbox")({
  component: InboxPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type FilterStatus = "open" | "closed" | "all";

type ThreadPreview = {
  id: string;
  visitorName: string | null;
  visitorKeyTail: string | null;
  status: string;
  updatedAt: string;
};

type ThreadDetail = {
  thread: {
    id: string;
    visitorName: string | null;
    visitorKeyTail: string | null;
    status: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    role: string;
    text: string;
    createdAt: string;
  }>;
};

function InboxPage() {
  const listFn = useServerFn(listGuardianInboxThreads);
  const getFn = useServerFn(getGuardianInboxThread);
  const replyFn = useServerFn(sendGuardianManualReply);
  const statusFn = useServerFn(setGuardianThreadStatus);

  const [filter, setFilter] = useState<FilterStatus>("open");
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Load list
  useEffect(() => {
    let active = true;
    setLoadingList(true);
    listFn({ data: { status: filter } })
      .then((data) => {
        if (active) setThreads(data);
      })
      .catch(() => {
        if (active) toast.error("Não foi possível carregar os atendimentos agora.");
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [filter, listFn]);

  // Load detail
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    getFn({ data: { threadId: selectedId } })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((e) => {
        if (active) {
          toast.error(e instanceof Error ? e.message : "Atendimento não encontrado ou indisponível.");
          setSelectedId(null);
        }
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, getFn]);

  async function handleSend() {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      await replyFn({ data: { threadId: selectedId, message: replyText } });
      setReplyText("");
      // Reload detail
      const refreshed = await getFn({ data: { threadId: selectedId } });
      setDetail(refreshed);
      // Reload list to update sorting
      const newList = await listFn({ data: { status: filter } });
      setThreads(newList);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a resposta agora.");
    } finally {
      setSending(false);
    }
  }

  async function handleStatusToggle() {
    if (!selectedId || !detail) return;
    const newStatus = detail.thread.status === "open" ? "closed" : "open";
    try {
      await statusFn({ data: { threadId: selectedId, status: newStatus } });
      // Reload detail
      const refreshed = await getFn({ data: { threadId: selectedId } });
      setDetail(refreshed);
      // Reload list
      const newList = await listFn({ data: { status: filter } });
      setThreads(newList);
    } catch (e) {
      toast.error("Não foi possível atualizar o status.");
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Sidebar List */}
      <div className="flex w-full shrink-0 flex-col border-r border-[color:var(--border)] lg:w-80">
        <div className="border-b border-[color:var(--border)] p-4">
          <h1 className="text-lg text-[color:var(--ivory)] uppercase tracking-wider serif mb-1">
            Atendimentos
          </h1>
          <p className="text-xs text-[color:var(--ivory-dim)] mb-4">
            Conversas públicas recebidas pela página do Guardião.
          </p>

          <div className="flex gap-2">
            <Button
              variant={filter === "open" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("open")}
              className="flex-1 text-xs"
            >
              Abertos
            </Button>
            <Button
              variant={filter === "closed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("closed")}
              className="flex-1 text-xs"
            >
              Resolvidos
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="flex-1 text-xs"
            >
              Todos
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="p-4 text-sm text-[color:var(--ivory-dim)]">Carregando...</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-[color:var(--ivory-dim)]">
              Nenhum atendimento público ainda.
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={`flex w-full flex-col items-start gap-1 p-4 text-left hover:bg-card/50 transition-colors ${
                      selectedId === t.id ? "bg-card/80" : ""
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium text-sm text-[color:var(--ivory)] truncate">
                        {t.visitorName || (t.visitorKeyTail ? `Visitante #${t.visitorKeyTail}` : "Anônimo")}
                      </span>
                      <span className="text-[10px] text-[color:var(--ivory-dim)] shrink-0">
                        {formatDate(t.updatedAt)}
                      </span>
                    </div>
                    <div className="text-xs text-[color:var(--ivory-dim)]">
                      {t.status === "open" ? "🟢 Aberto" : "⚪ Resolvido"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Detail */}
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-[color:var(--ivory-dim)]">
            Selecione uma conversa na lista para visualizar e responder.
          </div>
        ) : loadingDetail ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-[color:var(--ivory-dim)]">
            Carregando conversa...
          </div>
        ) : detail ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[color:var(--border)] p-4">
              <div>
                <h2 className="text-base text-[color:var(--ivory)]">
                  {detail.thread.visitorName ||
                    (detail.thread.visitorKeyTail
                      ? `Visitante #${detail.thread.visitorKeyTail}`
                      : "Anônimo")}
                </h2>
                <div className="text-xs text-[color:var(--ivory-dim)]">
                  {detail.thread.status === "open" ? "Status: Aberto" : "Status: Resolvido"}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleStatusToggle}>
                {detail.thread.status === "open" ? "Marcar como resolvido" : "Reabrir"}
              </Button>
            </div>

            {/* Fixo Aviso */}
            <div className="bg-[color:var(--gold)]/10 px-4 py-2 text-[11px] text-[color:var(--gold)] border-b border-[color:var(--gold)]/20 text-center uppercase tracking-wide">
              Responder aqui não confirma pagamento nem agendamento. Ações sensíveis continuam
              dependendo de revisão do Guardião.
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detail.messages.length === 0 ? (
                <div className="text-center text-sm text-[color:var(--ivory-dim)] py-8">
                  Nenhuma mensagem encontrada.
                </div>
              ) : (
                detail.messages.map((m) => {
                  const isKuan = m.role === "kuanyin";
                  return (
                    <div
                      key={m.id}
                      className={`flex w-full ${isKuan ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                          isKuan
                            ? "bg-card text-[color:var(--ivory)]"
                            : "bg-[color:var(--gold)]/20 text-[color:var(--ivory)]"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.text}</div>
                        <div className="mt-1 text-[10px] opacity-50 text-right">
                          {formatDate(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[color:var(--border)] p-4 bg-background">
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Responder como Guardião..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button onClick={handleSend} disabled={sending || !replyText.trim()}>
                    {sending ? "Enviando..." : "Enviar resposta"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-[color:var(--ivory-dim)]">
            Erro ao exibir os detalhes da conversa.
          </div>
        )}
      </div>
    </div>
  );
}
