import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getGuardianPublicConversation,
  getGuardianPublicPage,
  requestGuardianAppointment,
  requestGuardianOrder,
  sendGuardianPublicMessage,
  submitGuardianPublicProof,
} from "@/lib/kuanyin-public.functions";
import { kuanyinApple } from "@/lib/brand-assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { toast } from "sonner";

export const Route = createFileRoute("/g/$guardianId")({
  component: GuardianPublicPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
  head: () => ({
    meta: [
      { title: "Atendimento · Kuan-Yin" },
      { name: "robots", content: "noindex,nofollow" },
      {
        name: "description",
        content: "Página pública de atendimento comercial com Kuan-Yin.",
      },
    ],
  }),
});

type PublicState =
  | {
      ok: true;
      guardian: {
        id: string;
        businessContextId: string;
        slug: string;
        status: string;
        name: string;
        type: string | null;
        tone: string | null;
        services: string[];
        paymentMethods: string[];
        pixKey: string | null;
        scheduleRules: string[];
        notes: string | null;
        canonicalPath: string;
      };
    }
  | { ok: false; reason: string }
  | null;

type ChatMessage = { role: "visitor" | "kuanyin"; text: string };

function GuardianPublicPage() {
  const { guardianId } = Route.useParams();
  const getPage = useServerFn(getGuardianPublicPage);
  const getConversation = useServerFn(getGuardianPublicConversation);
  const requestAppointment = useServerFn(requestGuardianAppointment);
  const requestOrder = useServerFn(requestGuardianOrder);
  const submitProof = useServerFn(submitGuardianPublicProof);
  const sendMessage = useServerFn(sendGuardianPublicMessage);
  const [state, setState] = useState<PublicState>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [publicThreadId, setPublicThreadId] = useState<string | null>(null);
  const [visitorKey, setVisitorKey] = useState("");
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    service_name: "",
    starts_at: "",
    timezone: "",
    notes: "",
    honeypot: "",
  });
  const [orderForm, setOrderForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    description: "",
    estimated_budget: "",
    notes: "",
    honeypot: "",
  });
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [proofForm, setProofForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    amount: "",
    method: "Pix",
    comprovante_ref: "",
    payer_note: "",
    honeypot: "",
  });

  useEffect(() => {
    (async () => {
      const storageKey = `kuanyin-public:${guardianId}:visitor-key`;
      const threadStorageKey = `kuanyin-public:${guardianId}:thread-id`;
      const existingVisitorKey =
        sessionStorage.getItem(storageKey) ||
        (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      sessionStorage.setItem(storageKey, existingVisitorKey);
      setVisitorKey(existingVisitorKey);
      const existingThreadId = sessionStorage.getItem(threadStorageKey);
      if (existingThreadId) setPublicThreadId(existingThreadId);

      try {
        const pageState = (await getPage({ data: { guardianId } })) as PublicState;
        setState(pageState);
        if (pageState?.ok && existingThreadId) {
          const res = (await getConversation({
            data: { guardianId, visitorKey: existingVisitorKey, threadId: existingThreadId },
          })) as {
            ok: boolean;
            threadId?: string | null;
            messages?: Array<{ role: "visitor" | "kuanyin"; text: string }>;
          };
          if (res.ok) {
            if (res.threadId) {
              setPublicThreadId(res.threadId);
              sessionStorage.setItem(threadStorageKey, res.threadId);
            }
            setChat(res.messages ?? []);
          }
        }
      } catch {
        setState({ ok: false, reason: "network_error" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardianId]);

  const scheduleRules = useMemo(() => (state?.ok ? state.guardian.scheduleRules : []), [state]);

  if (loading)
    return (
      <Shell>
        <p className="text-sm text-[color:var(--ivory-dim)]">Carregando presença pública…</p>
      </Shell>
    );
  if (!state || !state.ok) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/50 p-5">
          <h1 className="serif text-xl text-[color:var(--ivory)]">Página não encontrada</h1>
          <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">
            Esta presença Kuan-Yin não existe, expirou ou ainda não foi publicada.
          </p>
        </div>
      </Shell>
    );
  }

  const guardian = state.guardian;

  async function submitChat() {
    const message = chatInput.trim();
    if (!message) return;
    setChat((prev) => [...prev, { role: "visitor", text: message }]);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = (await sendMessage({
        data: {
          guardianId,
          visitorName: visitorName.trim() || undefined,
          visitorKey: visitorKey || undefined,
          threadId: publicThreadId || undefined,
          message,
        },
      })) as { ok: boolean; threadId?: string; answer?: string; reason?: string };
      if (res.ok) {
        if (res.threadId) {
          setPublicThreadId(res.threadId);
          sessionStorage.setItem(`kuanyin-public:${guardianId}:thread-id`, res.threadId);
        }
        setChat((prev) => [...prev, { role: "kuanyin", text: res.answer ?? "Estou aqui." }]);
      } else {
        setChat((prev) => [
          ...prev,
          { role: "kuanyin", text: "Não consegui responder agora. Tente novamente em instantes." },
        ]);
      }
    } catch {
      toast.error("Falha ao conversar com a Kuan-Yin.");
    } finally {
      setChatBusy(false);
    }
  }

  async function submitAppointment() {
    if (!form.client_name.trim() || !form.service_name.trim() || !form.starts_at.trim()) {
      toast.error("Informe nome, serviço e horário desejado.");
      return;
    }
    try {
      const timezone =
        form.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
      const res = (await requestAppointment({ data: { guardianId, ...form, timezone } })) as {
        ok: boolean;
        reason?: string;
        traceId?: string;
      };
      if (res.ok) {
        const code = res.traceId ?? "trc_sem_codigo";
        setSuccessNotice(
          `Solicitação enviada. O Guardião vai conferir e confirmar o horário. Código: ${code}`,
        );
        toast.success(`Solicitação enviada ao Guardião. Código: ${code}`);
        setForm({
          client_name: "",
          client_email: "",
          client_phone: "",
          service_name: "",
          starts_at: "",
          timezone: "",
          notes: "",
          honeypot: "",
        });
      } else {
        const code = res.traceId ? ` Código de suporte: ${res.traceId}.` : "";
        toast.error(
          (res.reason === "rate_limited"
            ? "Muitas tentativas. Aguarde um pouco."
            : res.reason === "invalid_datetime"
              ? "Informe uma data e horário válidos."
              : "Não foi possível solicitar agora.") + code,
        );
      }
    } catch {
      toast.error("Falha de rede ao solicitar agendamento.");
    }
  }

  async function submitOrderRequest() {
    if (!orderForm.client_name.trim() || !orderForm.description.trim()) {
      toast.error("Informe nome e o que você deseja pedir/orçar.");
      return;
    }
    try {
      const res = (await requestOrder({ data: { guardianId, ...orderForm } })) as {
        ok: boolean;
        reason?: string;
        traceId?: string;
      };
      if (res.ok) {
        const code = res.traceId ?? "trc_sem_codigo";
        setSuccessNotice(`Pedido/orçamento enviado ao Guardião. Código: ${code}`);
        toast.success(`Pedido/orçamento enviado ao Guardião. Código: ${code}`);
        setOrderForm({
          client_name: "",
          client_email: "",
          client_phone: "",
          description: "",
          estimated_budget: "",
          notes: "",
          honeypot: "",
        });
      } else {
        const code = res.traceId ? ` Código de suporte: ${res.traceId}.` : "";
        toast.error(
          (res.reason === "rate_limited"
            ? "Muitas tentativas. Aguarde um pouco."
            : "Não foi possível enviar o pedido agora.") + code,
        );
      }
    } catch {
      toast.error("Falha de rede ao enviar pedido.");
    }
  }

  async function submitProofForm() {
    const amount_cents = Math.round(Number(proofForm.amount.replace(",", ".")) * 100);
    if (!proofForm.client_name.trim() || !Number.isFinite(amount_cents) || amount_cents <= 0) {
      toast.error("Informe nome e valor pago válido.");
      return;
    }
    try {
      const res = (await submitProof({
        data: {
          guardianId,
          client_name: proofForm.client_name,
          client_email: proofForm.client_email,
          client_phone: proofForm.client_phone,
          amount_cents,
          method: proofForm.method,
          comprovante_ref: proofForm.comprovante_ref,
          payer_note: proofForm.payer_note,
          honeypot: proofForm.honeypot,
        },
      })) as { ok: boolean; reason?: string; traceId?: string };
      if (res.ok) {
        const code = res.traceId ?? "trc_sem_codigo";
        setSuccessNotice(
          `Comprovante recebido. O Guardião ainda precisa conferir. Código: ${code}`,
        );
        toast.success(`Comprovante recebido como pendente. Código: ${code}`);
        setProofForm({
          client_name: "",
          client_email: "",
          client_phone: "",
          amount: "",
          method: "Pix",
          comprovante_ref: "",
          payer_note: "",
          honeypot: "",
        });
      } else {
        const code = res.traceId ? ` Código de suporte: ${res.traceId}.` : "";
        toast.error(
          (res.reason === "rate_limited"
            ? "Muitas tentativas. Aguarde um pouco."
            : "Não foi possível registrar o comprovante agora.") + code,
        );
      }
    } catch {
      toast.error("Falha de rede ao enviar comprovante.");
    }
  }

  return (
    <Shell>
      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-[color:var(--border)] bg-card/60 p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
            <Badge className="mb-3 bg-[color:oklch(0.69_0.22_350/0.22)] text-[color:var(--ivory)]">
              Atendimento público · Kuan-Yin
            </Badge>
            <h1 className="serif text-3xl sm:text-4xl text-[color:var(--ivory)]">
              {guardian.name}
            </h1>
            {guardian.type && (
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[color:var(--gold)]">
                {guardian.type}
              </p>
            )}
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ivory-dim)]">
              Converse com a Kuan-Yin deste Guardião, conheça serviços e solicite atendimento sem
              criar conta.
            </p>
            {guardian.notes && (
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--ivory)]">
                {guardian.notes}
              </p>
            )}
            <p className="mt-4 text-xs text-[color:var(--ivory-dim)]">
              Link público:{" "}
              <code className="text-[color:var(--ivory)]">{guardian.canonicalPath}</code>
            </p>
          </div>

          <InfoCard title="Serviços">
            {guardian.services.length ? (
              <div className="flex flex-wrap gap-2">
                {guardian.services.map((service) => (
                  <Badge key={service} variant="outline">
                    {service}
                  </Badge>
                ))}
              </div>
            ) : (
              <Empty text="Este Guardião ainda não publicou serviços." />
            )}
          </InfoCard>

          <InfoCard title="Agenda e pagamentos">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                  Horários / regras
                </h3>
                {scheduleRules.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-[color:var(--ivory)]">
                    {scheduleRules.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                ) : (
                  <Empty text="Combine o melhor horário pelo chat ou formulário." />
                )}
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
                  Pagamento
                </h3>
                {guardian.paymentMethods.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-[color:var(--ivory)]">
                    {guardian.paymentMethods.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                ) : (
                  <Empty text="Formas de pagamento ainda não publicadas." />
                )}
                {guardian.pixKey && (
                  <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
                    Pix: <code className="text-[color:var(--ivory)]">{guardian.pixKey}</code>
                  </p>
                )}
              </div>
            </div>
          </InfoCard>
        </div>

        <div className="space-y-5">
          {successNotice && (
            <div className="rounded-2xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-4 text-sm text-[color:var(--ivory)]">
              {successNotice}
            </div>
          )}
          <InfoCard title="Conversar com a Kuan-Yin">
            <div className="space-y-3">
              <Input
                placeholder="Seu nome (opcional)"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
              />
              <div className="min-h-48 max-h-80 overflow-auto rounded-2xl border border-[color:var(--border)] bg-background/50 p-3 space-y-3">
                {chat.length === 0 && (
                  <Empty text="Pergunte sobre serviços, horários, pagamento ou próximos passos. A conversa ficará disponível nesta sessão para continuidade." />
                )}
                {chat.map((m, idx) => (
                  <div key={idx} className={m.role === "visitor" ? "text-right" : "text-left"}>
                    <div
                      className={
                        (m.role === "visitor" ? "bg-[color:var(--gold)]/20" : "bg-card") +
                        " inline-block max-w-[88%] rounded-2xl px-3 py-2 text-sm text-[color:var(--ivory)]"
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <Textarea
                rows={3}
                placeholder="Escreva sua mensagem…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <Button className="w-full" disabled={chatBusy} onClick={submitChat}>
                {chatBusy ? "Respondendo…" : "Enviar mensagem"}
              </Button>
            </div>
          </InfoCard>

          <InfoCard title="Solicitar agendamento">
            <div className="space-y-3">
              <input
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                value={form.honeypot}
                onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                aria-hidden
              />
              <Field label="Seu nome">
                <Input
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={form.client_email}
                    onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Serviço desejado">
                <Input
                  value={form.service_name}
                  onChange={(e) => setForm({ ...form, service_name: e.target.value })}
                />
              </Field>
              <Field label="Data/horário desejado">
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-[color:var(--ivory-dim)]">
                  Usaremos o fuso horário do seu dispositivo para ajudar o Guardião a conferir o
                  horário corretamente.
                </p>
              </Field>
              <Field label="Observações">
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              <Button className="w-full" onClick={submitAppointment}>
                Enviar solicitação
              </Button>
              <p className="text-[11px] text-[color:var(--ivory-dim)]">
                A solicitação entra na agenda do Guardião como pedido pendente. A confirmação final
                depende das regras do negócio. Esta página registra os dados enviados para que o
                Guardião possa responder; não envie informações sensíveis além do necessário.
              </p>
            </div>
          </InfoCard>

          <InfoCard title="Pedir orçamento ou produto">
            <div className="space-y-3">
              <input
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                value={orderForm.honeypot}
                onChange={(e) => setOrderForm({ ...orderForm, honeypot: e.target.value })}
                aria-hidden
              />
              <Field label="Seu nome">
                <Input
                  value={orderForm.client_name}
                  onChange={(e) => setOrderForm({ ...orderForm, client_name: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={orderForm.client_email}
                    onChange={(e) => setOrderForm({ ...orderForm, client_email: e.target.value })}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={orderForm.client_phone}
                    onChange={(e) => setOrderForm({ ...orderForm, client_phone: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="O que você deseja?">
                <Textarea
                  rows={4}
                  value={orderForm.description}
                  onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                />
              </Field>
              <Field label="Orçamento estimado (opcional)">
                <Input
                  value={orderForm.estimated_budget}
                  onChange={(e) => setOrderForm({ ...orderForm, estimated_budget: e.target.value })}
                />
              </Field>
              <Field label="Observações">
                <Textarea
                  rows={2}
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                />
              </Field>
              <Button className="w-full" onClick={submitOrderRequest}>
                Enviar pedido/orçamento
              </Button>
            </div>
          </InfoCard>

          <InfoCard title="Enviar comprovante">
            <div className="space-y-3">
              <input
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                value={proofForm.honeypot}
                onChange={(e) => setProofForm({ ...proofForm, honeypot: e.target.value })}
                aria-hidden
              />
              <Field label="Seu nome">
                <Input
                  value={proofForm.client_name}
                  onChange={(e) => setProofForm({ ...proofForm, client_name: e.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={proofForm.client_email}
                    onChange={(e) => setProofForm({ ...proofForm, client_email: e.target.value })}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    value={proofForm.client_phone}
                    onChange={(e) => setProofForm({ ...proofForm, client_phone: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor pago (R$)">
                  <Input
                    inputMode="decimal"
                    value={proofForm.amount}
                    onChange={(e) => setProofForm({ ...proofForm, amount: e.target.value })}
                  />
                </Field>
                <Field label="Método">
                  <Input
                    value={proofForm.method}
                    onChange={(e) => setProofForm({ ...proofForm, method: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Referência / ID da transação">
                <Input
                  value={proofForm.comprovante_ref}
                  onChange={(e) => setProofForm({ ...proofForm, comprovante_ref: e.target.value })}
                />
              </Field>
              <Field label="Observação">
                <Textarea
                  rows={2}
                  value={proofForm.payer_note}
                  onChange={(e) => setProofForm({ ...proofForm, payer_note: e.target.value })}
                />
              </Field>
              <Button className="w-full" onClick={submitProofForm}>
                Enviar comprovante
              </Button>
              <p className="text-[11px] text-[color:var(--ivory-dim)]">
                O comprovante é recebido como pendente. A confirmação só acontece após conferência
                do Guardião.
              </p>
            </div>
          </InfoCard>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-[color:var(--ivory)]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <img
            src={kuanyinApple.url}
            alt=""
            className="h-7 w-7"
            style={{ filter: "drop-shadow(0 0 8px rgba(236,72,153,0.45))" }}
          />
          <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--ivory-dim)]">
            presença pública · Kuan-Yin
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-card/45 p-5">
      <h2 className="serif mb-4 text-xl text-[color:var(--ivory)]">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[color:var(--ivory-dim)]">{text}</p>;
}
