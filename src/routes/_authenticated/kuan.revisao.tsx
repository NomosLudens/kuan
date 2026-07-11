import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPendingReviews, resolveReviewAction } from "@/lib/kuanyin-review.functions";
import {
  listMemoryCandidates,
  approveMemoryCandidate,
  rejectMemoryCandidate,
} from "@/lib/memory-review.functions";
import {
  listPendingSedimentos,
  confirmarSedimento,
  descartarSedimento,
} from "@/lib/sedimentar.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert, Sparkles, Brain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kuan/revisao")({
  component: KuanYinRevisaoPage,
});

type PendingItem = {
  id: string;
  type:
    | "kuanyin.client.review"
    | "kuanyin.appointment.review"
    | "kuanyin.order.review"
    | "kuanyin.payment.review"
    | "kuanyin.memory_candidate.review"
    | "kuanyin.sedimento.review";
  title: string;
  details: string;
  status: string;
  createdAt: string;
  extra?: {
    nivel?: string;
    confianca?: number;
  };
};

function KuanYinRevisaoPage() {
  const fetchReviews = useServerFn(getPendingReviews);
  const fetchMemoryCandidates = useServerFn(listMemoryCandidates);
  const fetchSedimentos = useServerFn(listPendingSedimentos);

  const resolveReview = useServerFn(resolveReviewAction);
  const approveCandidate = useServerFn(approveMemoryCandidate);
  const rejectCandidate = useServerFn(rejectMemoryCandidate);
  const confirmSed = useServerFn(confirmarSedimento);
  const discardSed = useServerFn(descartarSedimento);

  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // State for direct on-card editing of memory candidates and insights before confirming
  const [editingItems, setEditingItems] = useState<
    Record<string, { title: string; details: string }>
  >({});

  const startEditing = (id: string, title: string, details: string) => {
    if (editingItems[id]) return;
    setEditingItems((prev) => ({
      ...prev,
      [id]: { title, details },
    }));
  };

  const handleEditChange = (id: string, field: "title" | "details", value: string) => {
    setEditingItems((prev) => {
      const current = prev[id] || { title: "", details: "" };
      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all three streams of reviewable content in parallel.
      // Wrap memory candidates and sedimentos in safe catch blocks to prevent crash loop.
      const [opReviews, memoryRows, sedRows] = await Promise.all([
        fetchReviews(),
        fetchMemoryCandidates({ data: { status: "pending", domain: "kuanyin" } }).catch((err) => {
          console.warn("Failed to load memory candidates in review loop", err);
          return [];
        }),
        fetchSedimentos({ data: { limit: 100 } }).catch((err) => {
          console.warn("Failed to load sedimentos in review loop", err);
          return [];
        }),
      ]);

      const mappedMemories: PendingItem[] = memoryRows.map((m) => ({
        id: m.id,
        type: "kuanyin.memory_candidate.review",
        title: m.title,
        details: m.content,
        status: m.status,
        createdAt: m.createdAt,
      }));

      const mappedSedimentos: PendingItem[] = sedRows.map((s) => ({
        id: s.id,
        type: "kuanyin.sedimento.review",
        title: s.hipotese,
        details: s.resumo || "Sem resumo disponível.",
        status: "pending",
        createdAt: s.createdAt,
        extra: {
          nivel: s.nivel,
          confianca: s.confianca,
        },
      }));

      const mappedOp: PendingItem[] = opReviews.map((item) => ({
        id: item.id,
        type: item.type as any,
        title: item.title,
        details: item.details,
        status: item.status,
        createdAt: item.createdAt,
      }));

      setItems([...mappedOp, ...mappedMemories, ...mappedSedimentos]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar os itens para revisão.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResolve = async (
    id: string,
    type: PendingItem["type"],
    action: "confirm" | "reject",
    item: PendingItem,
  ) => {
    try {
      setProcessingId(id);
      setError(null);

      const edited = editingItems[id];
      const title = edited ? edited.title : item.title;
      const details = edited ? edited.details : item.details;

      if (type === "kuanyin.memory_candidate.review") {
        if (action === "confirm") {
          await approveCandidate({
            data: {
              id,
              title,
              content: details,
              domain: "kuanyin",
            },
          });
        } else {
          await rejectCandidate({ data: { id } });
        }
      } else if (type === "kuanyin.sedimento.review") {
        if (action === "confirm") {
          await confirmSed({
            data: {
              sedimentoId: id,
              titulo: title,
              conteudo: details,
            },
          });
        } else {
          await discardSed({ data: { sedimentoId: id } });
        }
      } else {
        await resolveReview({ data: { id, type: type as any, action } });
      }

      // Clean up local editing state for this item
      if (editingItems[id]) {
        setEditingItems((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }

      await load();
    } catch (err: any) {
      setError(err.message || "Erro ao resolver item. Ele pode ter sido modificado.");
    } finally {
      setProcessingId(null);
    }
  };

  const getBadgeColor = (type: PendingItem["type"]) => {
    switch (type) {
      case "kuanyin.client.review":
        return "bg-blue-500/20 text-blue-200 border-blue-500/30";
      case "kuanyin.appointment.review":
        return "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30";
      case "kuanyin.order.review":
        return "bg-emerald-500/20 text-emerald-200 border-emerald-500/30";
      case "kuanyin.payment.review":
        return "bg-amber-500/20 text-amber-200 border-amber-500/30";
      case "kuanyin.memory_candidate.review":
        return "bg-violet-500/20 text-violet-200 border-violet-500/30";
      case "kuanyin.sedimento.review":
        return "bg-rose-500/20 text-rose-200 border-rose-500/30";
      default:
        return "bg-gray-500/20 text-gray-200 border-gray-500/30";
    }
  };

  const getTypeLabel = (type: PendingItem["type"]) => {
    switch (type) {
      case "kuanyin.client.review":
        return "Cliente/Prospect";
      case "kuanyin.appointment.review":
        return "Agendamento";
      case "kuanyin.order.review":
        return "Pedido";
      case "kuanyin.payment.review":
        return "Pagamento";
      case "kuanyin.memory_candidate.review":
        return "Candidato a Memória";
      case "kuanyin.sedimento.review":
        return "Insight de Conversa";
      default:
        return "Desconhecido";
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-[color:var(--border)] p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card border border-[color:var(--border)] shadow-sm">
            <ShieldAlert className="size-5 text-[color:oklch(0.86_0.06_350)]" />
          </div>
          <div>
            <h1 className="text-base font-medium text-[color:var(--ivory)]">Central de Revisão</h1>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Ações, memórias e insights de conversa propostos pela Kuan-Yin que requerem
              confirmação humana.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {error && (
          <div className="mb-6 rounded-md bg-destructive/15 p-4 border border-destructive/30">
            <h3 className="text-sm font-medium text-destructive">Falha na operação</h3>
            <div className="mt-1 text-xs text-destructive/90">{error}</div>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-sm text-[color:var(--ivory-dim)] animate-pulse">
              Buscando pendências...
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-card border border-[color:var(--border)]">
              <Check className="size-6 text-[color:var(--ivory-dim)]" />
            </div>
            <h3 className="text-sm font-medium text-[color:var(--ivory)]">Tudo limpo!</h3>
            <p className="mt-1 text-xs text-[color:var(--ivory-dim)]">
              Nenhuma ação ou memória pendente de confirmação no momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isMemoryOrSedimento =
                item.type === "kuanyin.memory_candidate.review" ||
                item.type === "kuanyin.sedimento.review";

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex flex-col rounded-xl border border-[color:var(--border)] bg-card shadow-sm overflow-hidden"
                >
                  <div className="flex items-start justify-between p-4 border-b border-[color:var(--border)] bg-muted/20">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getBadgeColor(item.type)}`}
                    >
                      {isMemoryOrSedimento ? (
                        <Brain className="mr-1 size-3 shrink-0" />
                      ) : (
                        <Sparkles className="mr-1 size-3 shrink-0" />
                      )}
                      {getTypeLabel(item.type)}
                    </span>
                    <span className="text-[10px] text-[color:var(--ivory-dim)]">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex-1 p-4 flex flex-col gap-3 min-h-[140px]">
                    {isMemoryOrSedimento ? (
                      <div className="flex flex-col gap-2.5 flex-1">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase tracking-wider text-[color:var(--ivory-dim)] font-medium">
                            Título da Memória
                          </label>
                          <input
                            type="text"
                            value={editingItems[item.id]?.title ?? item.title}
                            onChange={(e) => {
                              startEditing(item.id, item.title, item.details);
                              handleEditChange(item.id, "title", e.target.value);
                            }}
                            className="w-full bg-card hover:bg-muted/30 focus:bg-muted/50 text-sm font-medium text-[color:var(--ivory)] rounded-lg px-2.5 py-1.5 border border-[color:var(--border)] focus:outline-none focus:border-[color:oklch(0.86_0.06_350)] transition-all"
                            placeholder="Título da memória"
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-[9px] uppercase tracking-wider text-[color:var(--ivory-dim)] font-medium">
                            Conteúdo / Descrição
                          </label>
                          <textarea
                            value={editingItems[item.id]?.details ?? item.details}
                            onChange={(e) => {
                              startEditing(item.id, item.title, item.details);
                              handleEditChange(item.id, "details", e.target.value);
                            }}
                            rows={4}
                            className="w-full bg-card hover:bg-muted/30 focus:bg-muted/50 text-xs text-[color:var(--ivory-dim)] focus:text-[color:var(--ivory)] rounded-lg px-2.5 py-1.5 border border-[color:var(--border)] focus:outline-none focus:border-[color:oklch(0.86_0.06_350)] resize-none transition-all flex-1"
                            placeholder="Conteúdo a ser guardado na memória"
                          />
                        </div>
                        {item.extra?.nivel && (
                          <div className="flex justify-between items-center text-[9px] text-[color:var(--ivory-dim)] mt-1 border-t border-[color:var(--border)] pt-2">
                            <span>
                              Nível:{" "}
                              <strong className="text-[color:oklch(0.86_0.06_350)] uppercase">
                                {item.extra.nivel}
                              </strong>
                            </span>
                            <span>
                              Confiança: <strong>{item.extra.confianca}/3</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <h4 className="font-medium text-sm text-[color:var(--ivory)] mb-1">
                          {item.title}
                        </h4>
                        <p className="text-xs text-[color:var(--ivory-dim)] leading-relaxed">
                          {item.details}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-[color:var(--border)] border-t border-[color:var(--border)]">
                    <Button
                      variant="ghost"
                      className="rounded-none bg-card hover:bg-destructive/10 hover:text-destructive h-10 text-xs font-medium transition-all"
                      disabled={processingId === item.id}
                      onClick={() => handleResolve(item.id, item.type, "reject", item)}
                    >
                      <X className="mr-1.5 size-3.5" />
                      Rejeitar
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-none bg-card hover:bg-emerald-500/10 hover:text-emerald-400 h-10 text-xs font-medium text-[color:oklch(0.86_0.06_350)] transition-all"
                      disabled={processingId === item.id}
                      onClick={() => handleResolve(item.id, item.type, "confirm", item)}
                    >
                      <Check className="mr-1.5 size-3.5" />
                      Confirmar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
