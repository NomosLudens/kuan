import { createFileRoute } from "@tanstack/react-start";
import { useServerFn } from "@tanstack/react-start";
import { getPendingReviews, resolveReviewAction } from "@/lib/kuanyin-review.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kuan-yin/revisao")({
  component: KuanYinRevisaoPage,
});

type PendingItem = Awaited<ReturnType<typeof getPendingReviews>>[number];

function KuanYinRevisaoPage() {
  const fetchReviews = useServerFn(getPendingReviews);
  const resolveReview = useServerFn(resolveReviewAction);

  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReviews();
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar os itens para revisão.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolve = async (
    id: string,
    type: PendingItem["type"],
    action: "confirm" | "reject",
  ) => {
    try {
      setProcessingId(id);
      setError(null);
      await resolveReview({ data: { id, type, action } });
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
              Ações propostas pela Kuan-Yin que requerem confirmação humana.
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
            <div className="text-sm text-[color:var(--ivory-dim)]">Buscando pendências...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-card border border-[color:var(--border)]">
              <Check className="size-6 text-[color:var(--ivory-dim)]" />
            </div>
            <h3 className="text-sm font-medium text-[color:var(--ivory)]">Tudo limpo!</h3>
            <p className="mt-1 text-xs text-[color:var(--ivory-dim)]">
              Nenhuma ação pendente de confirmação no momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-xl border border-[color:var(--border)] bg-card shadow-sm overflow-hidden"
              >
                <div className="flex items-start justify-between p-4 border-b border-[color:var(--border)] bg-muted/20">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getBadgeColor(item.type)}`}
                  >
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

                <div className="flex-1 p-4">
                  <h4 className="font-medium text-sm text-[color:var(--ivory)] mb-1">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[color:var(--ivory-dim)]">{item.details}</p>
                </div>

                <div className="grid grid-cols-2 gap-px bg-[color:var(--border)] border-t border-[color:var(--border)]">
                  <Button
                    variant="ghost"
                    className="rounded-none bg-card hover:bg-destructive/10 hover:text-destructive h-10 text-xs"
                    disabled={processingId === item.id}
                    onClick={() => handleResolve(item.id, item.type, "reject")}
                  >
                    <X className="mr-1.5 size-3.5" />
                    Rejeitar
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-none bg-card hover:bg-emerald-500/10 hover:text-emerald-400 h-10 text-xs text-[color:oklch(0.86_0.06_350)]"
                    disabled={processingId === item.id}
                    onClick={() => handleResolve(item.id, item.type, "confirm")}
                  >
                    <Check className="mr-1.5 size-3.5" />
                    Confirmar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
