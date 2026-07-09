import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getGuardianPublicConversation,
  getGuardianPublicPage,
  sendGuardianPublicMessage,
} from "@/lib/kuanyin-public.functions";
import { kuanyinApple } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/g/$guardianId")({
  component: GuardianPublicPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
  head: () => ({
    meta: [
      { title: "Atendimento · Kuan-Yin" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "description", content: "Página pública do Guardião com dados comerciais." },
    ],
  }),
});

type PublicMessage = {
  id: string;
  role: "visitor" | "kuanyin";
  text: string;
  createdAt: string;
};

type PublicState =
  | {
      ok: true;
      guardian: {
        slug: string;
        name: string;
        type: string | null;
        tone: string | null;
        services: string[];
        prices: string[];
        paymentMethods: string[];
        scheduleRules: string[];
        notes: string | null;
        canonicalPath: string;
      };
    }
  | { ok: false; reason: string }
  | null;

function publicVisitorKey(slug: string): string {
  const storageKey = `kuan-public-chat:${slug}:visitor`;
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return "anonymous";
  }
}

function GuardianPublicPage() {
  const { guardianId } = Route.useParams();
  const getPage = useServerFn(getGuardianPublicPage);
  const getConversation = useServerFn(getGuardianPublicConversation);
  const sendMessage = useServerFn(sendGuardianPublicMessage);
  const [state, setState] = useState<PublicState>(null);
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const pageState = (await getPage({ data: { guardianId } })) as PublicState;
        if (active) setState(pageState);
      } catch {
        if (active) setState({ ok: false, reason: "read_error" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getPage, guardianId]);

  useEffect(() => {
    if (!state?.ok) return;
    const key = publicVisitorKey(state.guardian.slug);
    setVisitorKey(key);
    let active = true;
    setConversationLoading(true);
    setChatError(null);
    (async () => {
      try {
        const conversation = await getConversation({
          data: { guardianId: state.guardian.slug, visitorKey: key },
        });
        if (!active) return;
        if (conversation.ok) {
          setThreadId(conversation.threadId);
          setMessages(conversation.messages as PublicMessage[]);
        } else {
          setChatError("Não foi possível carregar a conversa pública agora.");
        }
      } catch {
        if (active) setChatError("Não foi possível carregar a conversa pública agora.");
      } finally {
        if (active) setConversationLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getConversation, state]);

  const publicDataCount = useMemo(() => {
    if (!state?.ok) return 0;
    const guardian = state.guardian;
    return [
      guardian.type,
      guardian.tone,
      guardian.notes,
      ...guardian.services,
      ...guardian.prices,
      ...guardian.paymentMethods,
      ...guardian.scheduleRules,
    ].filter(Boolean).length;
  }, [state]);

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state?.ok || !visitorKey) return;
    const text = message.trim();
    if (!text) {
      setChatError("Escreva uma mensagem antes de enviar.");
      return;
    }
    setSending(true);
    setChatError(null);
    try {
      const result = await sendMessage({
        data: { guardianId: state.guardian.slug, visitorKey, threadId: threadId ?? undefined, message: text },
      });
      if (!result.ok) {
        setChatError("Não foi possível enviar agora. Tente novamente em instantes.");
        return;
      }
      setThreadId(result.threadId);
      setMessage("");
      const conversation = await getConversation({
        data: { guardianId: state.guardian.slug, visitorKey, threadId: result.threadId },
      });
      if (conversation.ok) setMessages(conversation.messages as PublicMessage[]);
    } catch {
      setChatError("Erro ao enviar. Nenhuma confirmação sensível foi executada.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-[color:var(--ivory-dim)]">Carregando página pública…</p>
      </Shell>
    );
  }

  if (!state || !state.ok) {
    const message =
      state?.reason === "read_error"
        ? "Não foi possível ler esta página agora."
        : "Nenhum Guardião publicado foi encontrado para este slug.";
    return (
      <Shell>
        <Notice title="Página indisponível" text={message} />
      </Shell>
    );
  }

  const guardian = state.guardian;
  const hasPublicData = publicDataCount > 0;

  return (
    <Shell>
      <section className="space-y-5">
        <div className="rounded-3xl border border-[color:var(--border)] bg-card/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7">
          <Badge className="mb-3 bg-[color:oklch(0.69_0.22_350/0.22)] text-[color:var(--ivory)]">
            Página pública · Kuan-Yin
          </Badge>
          <h1 className="serif text-3xl text-[color:var(--ivory)] sm:text-4xl">{guardian.name}</h1>
          {guardian.type && (
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[color:var(--gold)]">
              {guardian.type}
            </p>
          )}
          {guardian.tone && (
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ivory-dim)]">
              Atendimento: {guardian.tone}
            </p>
          )}
          {guardian.notes && (
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ivory)]">
              {guardian.notes}
            </p>
          )}
          <p className="mt-4 text-xs text-[color:var(--ivory-dim)]">
            Link público: <code className="text-[color:var(--ivory)]">{guardian.canonicalPath}</code>
          </p>
        </div>

        {!hasPublicData && (
          <Notice
            title="Chat indisponível por falta de configuração pública"
            text="O Guardião já tem uma página pública, mas ainda não publicou detalhes comerciais suficientes para orientar o atendimento."
          />
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <InfoCard title="Serviços"><List values={guardian.services} empty="Serviços ainda não publicados." /></InfoCard>
          <InfoCard title="Preços / faixas"><List values={guardian.prices} empty="Preços ainda não publicados." /></InfoCard>
          <InfoCard title="Formas de pagamento"><List values={guardian.paymentMethods} empty="Formas de pagamento ainda não publicadas." /></InfoCard>
          <InfoCard title="Agenda"><List values={guardian.scheduleRules} empty="Regras de agenda ainda não publicadas." /></InfoCard>
        </div>

        <div className="rounded-3xl border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 p-5 text-sm leading-relaxed text-[color:var(--ivory)]">
          <p>Pedidos, agendamentos e pagamentos dependem de confirmação do Guardião.</p>
          <p className="mt-2">Comprovante recebido não é pagamento confirmado.</p>
        </div>

        <div className="rounded-3xl border border-[color:var(--border)] bg-card/50 p-5">
          <h2 className="serif text-2xl text-[color:var(--ivory)]">Converse com a Kuan-Yin</h2>
          <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">
            Cliente sem login: deixe dúvidas, pedido de horário, nome e contato se quiser. A Kuan-Yin orienta; o Guardião confirma depois.
          </p>
          <div className="mt-4 min-h-40 space-y-3 rounded-2xl border border-[color:var(--border)] bg-background/40 p-4">
            {conversationLoading && <p className="text-sm text-[color:var(--ivory-dim)]">Carregando conversa…</p>}
            {!conversationLoading && messages.length === 0 && (
              <p className="text-sm text-[color:var(--ivory-dim)]">Sem mensagens ainda. Envie sua primeira pergunta.</p>
            )}
            {messages.map((item) => (
              <div key={item.id} className={item.role === "visitor" ? "text-right" : "text-left"}>
                <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${item.role === "visitor" ? "bg-[color:var(--gold)]/20 text-[color:var(--ivory)]" : "bg-card text-[color:var(--ivory)]"}`}>
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          {chatError && <p className="mt-3 text-sm text-red-300">{chatError}</p>}
          <form onSubmit={handleSend} className="mt-4 space-y-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={3000}
              disabled={sending || conversationLoading || !hasPublicData}
              placeholder="Pergunte sobre serviços, preços, horários ou informe que tem um comprovante."
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[color:var(--ivory-dim)]">Nenhum agendamento ou pagamento é confirmado por este chat.</p>
              <Button type="submit" disabled={sending || conversationLoading || !hasPublicData}>
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-[color:var(--ivory)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <img src={kuanyinApple.url} alt="" className="h-7 w-7" style={{ filter: "drop-shadow(0 0 8px rgba(236,72,153,0.45))" }} />
          <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--ivory-dim)]">presença pública · Kuan-Yin</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-3xl border border-[color:var(--border)] bg-card/45 p-5"><h2 className="serif mb-4 text-xl text-[color:var(--ivory)]">{title}</h2>{children}</div>;
}

function Notice({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-[color:var(--border)] bg-card/50 p-5"><h1 className="serif text-xl text-[color:var(--ivory)]">{title}</h1><p className="mt-2 text-sm text-[color:var(--ivory-dim)]">{text}</p></div>;
}

function List({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p className="text-sm text-[color:var(--ivory-dim)]">{empty}</p>;
  return <ul className="space-y-2 text-sm text-[color:var(--ivory)]">{values.map((value) => <li key={value}>• {value}</li>)}</ul>;
}
