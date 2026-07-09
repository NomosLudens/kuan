import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listOrders, confirmOrder, cancelOrder, createPortalToken } from "@/lib/kuanyin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan-yin/pedidos")({
  component: PedidosPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type Row = {
  id: string;
  description: string;
  price_cents: number | null;
  status: "draft" | "proposed" | "confirmed" | "cancelled" | "delivered";
  created_at: string;
  kuanyin_clients: { nome: string } | null;
};

function PedidosPage() {
  const list = useServerFn(listOrders);
  const confirm = useServerFn(confirmOrder);
  const cancel = useServerFn(cancelOrder);
  const mkToken = useServerFn(createPortalToken);
  async function share(orderId: string) {
    try {
      const t = (await mkToken({ data: { scope: "order", order_id: orderId } })) as { id: string };
      const url = `${window.location.origin}/portal/${t.id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link do portal copiado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha.");
    }
  }
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await list()) as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [list]);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-4">
      <h1 className="serif text-[color:var(--gold)] text-lg tracking-[0.18em] uppercase">
        Pedidos
      </h1>
      {loading && <p className="text-sm text-[color:var(--ivory-dim)]">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-[color:var(--ivory-dim)]">Nenhum pedido ainda.</p>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-[color:var(--border)] bg-card/40 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-[color:var(--ivory)] truncate">{r.description}</div>
                <div className="text-[11px] text-[color:var(--ivory-dim)] truncate">
                  {r.kuanyin_clients?.nome ?? "—"}
                  {r.price_cents != null &&
                    ` · ${(r.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={
                    "text-[10px] tracking-[0.18em] uppercase " +
                    (r.status === "confirmed" || r.status === "delivered"
                      ? "text-[color:var(--gold)]"
                      : "text-[color:var(--ivory-dim)]")
                  }
                >
                  {r.status}
                </span>
                {(r.status === "proposed" || r.status === "draft") && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await confirm({ data: { id: r.id } });
                          toast.success("Confirmado.");
                          reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha.");
                        }
                      }}
                    >
                      Confirmar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await cancel({ data: { id: r.id } });
                          toast.success("Cancelado.");
                          reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha.");
                        }
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
                <Button size="sm" variant="ghost" onClick={() => share(r.id)}>
                  Compartilhar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
