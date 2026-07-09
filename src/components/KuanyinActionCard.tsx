// Cartão "Posso fazer isto?" — renderiza propostas estruturadas vindas do
// chat da faceta Kuan-Yin. Confirmar → chama server fn correspondente.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createClient as createClientFn,
  recognizeClient,
  proposeAppointment,
  confirmAppointment,
  proposeOrder,
  confirmOrder,
  registerProof,
} from "@/lib/kuanyin.functions";
import type { KuanyinActionBlock } from "@/lib/kuanyin-action";

const TYPE_LABEL: Record<KuanyinActionBlock["type"], string> = {
  "kuanyin.client.create": "Cadastrar cliente",
  "kuanyin.appointment.propose": "Propor agendamento",
  "kuanyin.order.propose": "Propor pedido",
  "kuanyin.payment.proof": "Registrar comprovante (pendente)",
};

export function KuanyinActionCard({ action }: { action: KuanyinActionBlock }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "dismissed" | "error">("idle");
  const [resultId, setResultId] = useState<string | null>(null);

  const createClient = useServerFn(createClientFn);
  const recognize = useServerFn(recognizeClient);
  const proposeAppt = useServerFn(proposeAppointment);
  const confirmAppt = useServerFn(confirmAppointment);
  const proposeOrd = useServerFn(proposeOrder);
  const confirmOrd = useServerFn(confirmOrder);
  const regProof = useServerFn(registerProof);

  const pretty = useMemo(
    () => prettifyData(action.type, action.data as Record<string, unknown>),
    [action.type, action.data],
  );

  async function resolveClientId(): Promise<string | null> {
    const d = action.data as {
      client_id?: string;
      client_name?: string;
      client_phone?: string;
      client_email?: string;
    };
    if (d.client_id) return d.client_id;
    const query = (d.client_name || d.client_phone || d.client_email || "").trim();
    if (!query) return null;
    try {
      const rows = (await recognize({ data: { query } })) as { id: string }[];
      if (rows[0]) return rows[0].id;
    } catch {
      /* ignore */
    }
    if (d.client_name) {
      try {
        const created = (await createClient({
          data: {
            nome: d.client_name,
            telefone: d.client_phone ?? null,
            email: d.client_email ?? null,
            status: "prospect",
          },
        })) as { id: string };
        return created.id;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  async function run() {
    setState("running");
    try {
      const d = action.data as Record<string, unknown>;
      if (action.type === "kuanyin.client.create") {
        const row = (await createClient({
          data: {
            nome: String(d.nome ?? d.client_name ?? "").trim() || "Sem nome",
            telefone: (d.telefone as string) ?? null,
            email: (d.email as string) ?? null,
            notas: (d.notas as string) ?? null,
            status: "prospect",
          },
        })) as { id: string };
        setResultId(row.id);
        toast.success("Cliente cadastrado.");
      } else if (action.type === "kuanyin.appointment.propose") {
        const clientId = await resolveClientId();
        const row = (await proposeAppt({
          data: {
            client_id: clientId,
            service_name: String(d.service_name ?? "Serviço"),
            starts_at: String(d.starts_at ?? new Date().toISOString()),
            ends_at: (d.ends_at as string) ?? null,
            price_cents: typeof d.price_cents === "number" ? d.price_cents : null,
            notes: (d.notes as string) ?? null,
          },
        })) as { id: string };
        setResultId(row.id);
        toast.success("Agendamento proposto. Confirme quando o cliente confirmar.");
      } else if (action.type === "kuanyin.order.propose") {
        const clientId = await resolveClientId();
        const row = (await proposeOrd({
          data: {
            client_id: clientId,
            description: String(d.description ?? "Pedido"),
            items: Array.isArray(d.items) ? (d.items as unknown[]) : [],
            price_cents: typeof d.price_cents === "number" ? d.price_cents : null,
            status: "proposed",
          },
        })) as { id: string };
        setResultId(row.id);
        toast.success("Pedido proposto.");
      } else if (action.type === "kuanyin.payment.proof") {
        const row = (await regProof({
          data: {
            order_id: (d.order_id as string) ?? null,
            appointment_id: (d.appointment_id as string) ?? null,
            amount_cents: Number(d.amount_cents ?? 0),
            method: (d.method as string) ?? null,
            comprovante_ref: (d.comprovante_ref as string) ?? null,
            fraud_alert_note: (d.fraud_alert_note as string) ?? null,
          },
        })) as { id: string };
        setResultId(row.id);
        toast.success("Comprovante registrado como pendente. Verifique manualmente.");
      }
      setState("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar ação.");
      setState("error");
    }
  }

  async function confirmAfter() {
    if (!resultId) return;
    try {
      if (action.type === "kuanyin.appointment.propose") {
        await confirmAppt({ data: { id: resultId } });
        toast.success("Agendamento confirmado e adicionado ao calendário.");
      } else if (action.type === "kuanyin.order.propose") {
        await confirmOrd({ data: { id: resultId } });
        toast.success("Pedido confirmado.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao confirmar.");
    }
  }

  if (state === "dismissed") return null;

  const needsFinalConfirm =
    action.type === "kuanyin.appointment.propose" || action.type === "kuanyin.order.propose";

  return (
    <div className="my-3 rounded-2xl border border-[color:var(--gold)]/40 bg-card/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--gold)] serif">
            Preview · nada foi gravado ainda
          </div>
          <div className="text-xs text-[color:var(--ivory-dim)] tracking-wider uppercase">
            {TYPE_LABEL[action.type] ?? action.type}
          </div>
        </div>
        <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--ivory-dim)]">
          {state === "done"
            ? needsFinalConfirm
              ? "registrado · pendente confirmação"
              : "registrado"
            : state === "error"
              ? "erro"
              : "aguardando você"}
        </div>
      </div>
      <p className="text-sm text-[color:var(--ivory)] mb-3">{action.summary}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-[color:var(--ivory-dim)] mb-3">
        {pretty.map((p) => (
          <Row key={p.k} k={p.k} v={p.v} />
        ))}
      </dl>
      {state === "idle" && (
        <p className="text-[10px] italic text-[color:var(--ivory-dim)] mb-3">
          Revise os dados acima. Só serão gravados se você clicar em{" "}
          <b className="not-italic text-[color:var(--ivory)]">Confirmar</b>.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {state === "idle" && (
          <>
            <Button size="sm" onClick={run}>
              Confirmar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setState("dismissed")}>
              Cancelar
            </Button>
          </>
        )}
        {state === "running" && (
          <Button size="sm" disabled>
            Gravando…
          </Button>
        )}
        {state === "done" && needsFinalConfirm && (
          <Button size="sm" onClick={confirmAfter}>
            Confirmar definitivamente
          </Button>
        )}
        {state === "error" && (
          <>
            <Button size="sm" onClick={run}>
              Tentar de novo
            </Button>
            <Button size="sm" variant="outline" onClick={() => setState("dismissed")}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="uppercase tracking-[0.16em] opacity-70">{k}</dt>
      <dd className="text-[color:var(--ivory)] break-words">{v}</dd>
    </>
  );
}

function prettifyData(
  type: KuanyinActionBlock["type"],
  data: Record<string, unknown>,
): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = [];
  const push = (k: string, v: unknown) => {
    if (v === undefined || v === null || v === "") return;
    out.push({ k, v: typeof v === "string" ? v : JSON.stringify(v) });
  };
  if (type === "kuanyin.client.create") {
    push("nome", data.nome ?? data.client_name);
    push("telefone", data.telefone);
    push("e-mail", data.email);
    push("notas", data.notas);
  } else if (type === "kuanyin.appointment.propose") {
    push("cliente", data.client_name ?? data.client_id);
    push("serviço", data.service_name);
    push("início", fmtDate(data.starts_at));
    push("fim", fmtDate(data.ends_at));
    push("preço", fmtMoney(data.price_cents));
    push("notas", data.notes);
  } else if (type === "kuanyin.order.propose") {
    push("cliente", data.client_name ?? data.client_id);
    push("descrição", data.description);
    push("preço", fmtMoney(data.price_cents));
  } else if (type === "kuanyin.payment.proof") {
    push("valor", fmtMoney(data.amount_cents));
    push("método", data.method);
    push("comprovante", data.comprovante_ref);
    push("alerta", data.fraud_alert_note);
  }
  return out;
}

function fmtDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return v;
  }
}

function fmtMoney(v: unknown): string | null {
  if (typeof v !== "number") return null;
  return (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
