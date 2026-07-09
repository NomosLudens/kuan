// Portal público do cliente — sem login.
// Acesso autorizado por uuid em `kuanyin_portal_tokens`.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getPortalView,
  submitPortalProof,
  submitPortalDecision,
} from "@/lib/kuanyin-portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { kuanyinApple } from "@/lib/brand-assets";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/portal/$token")({
  component: PortalPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
  head: () => ({
    meta: [{ title: "Portal · Kuan-Yin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
});

type PortalTarget = {
  service_name?: string;
  starts_at?: string;
  ends_at?: string | null;
  notes?: string | null;
  description?: string;
  price_cents?: number | null;
  status?: string;
  kuanyin_clients?: { nome?: string } | null;
};

type PortalBusiness = {
  nome?: string;
  tom_voz?: string | null;
  pix_chave?: string | null;
};

type View =
  | {
      ok: true;
      kind: "appointment";
      target: PortalTarget;
      business: PortalBusiness | null;
      token: string;
    }
  | {
      ok: true;
      kind: "order";
      target: PortalTarget;
      business: PortalBusiness | null;
      token: string;
    }
  | { ok: false; reason: string }
  | null;

function fmtBRL(c: number | null | undefined) {
  if (c == null) return "—";
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PortalPage() {
  const { token } = Route.useParams();
  const view = useServerFn(getPortalView);
  const sendProof = useServerFn(submitPortalProof);
  const sendDecision = useServerFn(submitPortalDecision);
  const [state, setState] = useState<View>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Pix");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setState((await view({ data: { token } })) as View);
      } catch {
        setState({ ok: false, reason: "network_error" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading)
    return (
      <Shell>
        <p className="text-sm text-[color:var(--ivory-dim)]">Carregando…</p>
      </Shell>
    );
  if (!state || !state.ok) {
    return (
      <Shell>
        <p className="text-sm text-[color:var(--ivory-dim)]">Este link expirou ou não é válido.</p>
      </Shell>
    );
  }

  const isAppt = state.kind === "appointment";
  const t = state.target;
  const biz = state.business;
  const cliente = t.kuanyin_clients?.nome ?? "Cliente";

  async function decide(accept: boolean) {
    try {
      const r = (await sendDecision({ data: { token, accept } })) as { ok: boolean };
      if (r.ok) toast.success(accept ? "Resposta enviada: aceito." : "Resposta enviada: recusado.");
      else toast.error("Não foi possível enviar agora.");
    } catch {
      toast.error("Falha de rede.");
    }
  }
  async function uploadProof() {
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    try {
      const r = (await sendProof({
        data: {
          token,
          amount_cents: cents,
          method,
          comprovante_ref: ref || undefined,
          payer_note: note || undefined,
        },
      })) as { ok: boolean };
      if (r.ok) {
        toast.success("Comprovante recebido. O guardião vai conferir.");
        setAmount("");
        setRef("");
        setNote("");
      } else toast.error("Não foi possível registrar agora.");
    } catch {
      toast.error("Falha de rede.");
    }
  }

  return (
    <Shell>
      <div className="space-y-1 mb-4">
        <div className="serif text-[color:var(--gold)] text-base tracking-[0.18em] uppercase">
          {biz?.nome ?? "Atendimento"}
        </div>
        <div className="text-xs text-[color:var(--ivory-dim)]">
          Olá, {cliente}. Aqui está a proposta enviada para você.
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-card/40 p-4 space-y-2">
        {isAppt ? (
          <>
            <div className="text-sm text-[color:var(--ivory)]">{t.service_name}</div>
            <div className="text-[12px] text-[color:var(--ivory-dim)]">
              {new Date(t.starts_at ?? "").toLocaleString("pt-BR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
              {t.ends_at &&
                ` — ${new Date(t.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
            {t.notes && (
              <div className="text-[12px] italic text-[color:var(--ivory-dim)]">{t.notes}</div>
            )}
            <div className="text-sm">
              Valor: <strong>{fmtBRL(t.price_cents)}</strong>
            </div>
            <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--ivory-dim)]">
              Status: {t.status}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-[color:var(--ivory)]">{t.description}</div>
            <div className="text-sm">
              Valor: <strong>{fmtBRL(t.price_cents)}</strong>
            </div>
            <div className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--ivory-dim)]">
              Status: {t.status}
            </div>
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => decide(true)}>
            Aceito a proposta
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(false)}>
            Não posso agora
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-card/40 p-4 mt-4 space-y-3">
        <div>
          <div className="text-sm text-[color:var(--ivory)]">Enviar comprovante</div>
          <div className="text-[11px] text-[color:var(--ivory-dim)]">
            Após pagar, registre aqui o comprovante. <strong>Importante:</strong> o comprovante é
            recebido como pendente — a confirmação só acontece quando o atendente verifica.
            {biz?.pix_chave && (
              <>
                {" "}
                · Pix: <code className="text-[color:var(--ivory)]">{biz.pix_chave}</code>
              </>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="amt">Valor (R$)</Label>
            <Input
              id="amt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="met">Forma</Label>
            <Input id="met" value={method} onChange={(e) => setMethod(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ref">Referência / ID da transação (opcional)</Label>
            <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="note">Observação (opcional)</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={uploadProof}>Enviar comprovante</Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-[color:var(--ivory)]">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-5">
          <img
            src={kuanyinApple.url}
            alt=""
            className="w-6 h-6"
            style={{ filter: "drop-shadow(0 0 6px rgba(236,72,153,0.45))" }}
          />
          <span className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--ivory-dim)]">
            portal · cuidado comercial
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
