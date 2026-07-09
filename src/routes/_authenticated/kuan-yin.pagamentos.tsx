import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPayments, verifyPayment, rejectPayment } from "@/lib/kuanyin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/kuan-yin/pagamentos")({
  component: PagamentosPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type Row = {
  id: string;
  amount_cents: number;
  method: string | null;
  comprovante_ref: string | null;
  status: "received_proof" | "verified" | "rejected" | "pending";
  fraud_alert_note: string | null;
  created_at: string;
};

function PagamentosPage() {
  const list = useServerFn(listPayments);
  const verify = useServerFn(verifyPayment);
  const reject = useServerFn(rejectPayment);
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
        Pagamentos
      </h1>
      <p className="text-[11px] text-[color:var(--ivory-dim)] italic">
        Comprovante recebido ≠ pagamento confirmado. Verifique manualmente antes de marcar como
        "verified".
      </p>
      {loading && <p className="text-sm text-[color:var(--ivory-dim)]">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-[color:var(--ivory-dim)]">Nenhum comprovante ainda.</p>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-[color:var(--border)] bg-card/40 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-[color:var(--ivory)]">
                  {(r.amount_cents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  {r.method && (
                    <span className="text-[color:var(--ivory-dim)] text-xs"> · {r.method}</span>
                  )}
                </div>
                <div className="text-[11px] text-[color:var(--ivory-dim)] truncate">
                  {r.comprovante_ref ?? "—"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
                {r.fraud_alert_note && (
                  <div className="text-[11px] text-red-300 mt-1 italic">⚠ {r.fraud_alert_note}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={
                    "text-[10px] tracking-[0.18em] uppercase " +
                    (r.status === "verified"
                      ? "text-[color:var(--gold)]"
                      : r.status === "rejected"
                        ? "text-red-400"
                        : "text-[color:var(--ivory-dim)]")
                  }
                >
                  {r.status === "received_proof" ? "pendente" : r.status}
                </span>
                {(r.status === "received_proof" || r.status === "pending") && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await verify({ data: { id: r.id } });
                          toast.success("Verificado.");
                          reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha.");
                        }
                      }}
                    >
                      Verificar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const note = prompt("Motivo da rejeição (opcional):") ?? undefined;
                        try {
                          await reject({ data: { id: r.id, note } });
                          toast.success("Rejeitado.");
                          reload();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Falha.");
                        }
                      }}
                    >
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
