import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getGuardianPublicConversation,
  getGuardianPublicPage,
  sendGuardianPublicMessage,
  requestGuardianAppointment,
  requestGuardianOrder,
  submitGuardianPublicProof,
  submitGuardianPublicContact,
} from "@/lib/kuanyin-public.functions";
import { kuanyinApple } from "@/lib/brand-assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Calendar, FileText, DollarSign, Phone, Sparkles } from "lucide-react";

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
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
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
  const requestAppointment = useServerFn(requestGuardianAppointment);
  const requestOrder = useServerFn(requestGuardianOrder);
  const submitProof = useServerFn(submitGuardianPublicProof);
  const submitContact = useServerFn(submitGuardianPublicContact);

  const [state, setState] = useState<PublicState>(null);
  const [loading, setLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog states
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Contact details stored in localStorage
  const [visitorName, setVisitorName] = useState(() => {
    try {
      return window.localStorage.getItem(`kuan-public-chat:${guardianId}:name`) || "";
    } catch {
      return "";
    }
  });
  const [visitorEmail, setVisitorEmail] = useState(() => {
    try {
      return window.localStorage.getItem(`kuan-public-chat:${guardianId}:email`) || "";
    } catch {
      return "";
    }
  });
  const [visitorPhone, setVisitorPhone] = useState(() => {
    try {
      return window.localStorage.getItem(`kuan-public-chat:${guardianId}:phone`) || "";
    } catch {
      return "";
    }
  });

  const saveContactInfo = (name: string, email: string, phone: string) => {
    try {
      window.localStorage.setItem(`kuan-public-chat:${guardianId}:name`, name);
      window.localStorage.setItem(`kuan-public-chat:${guardianId}:email`, email);
      window.localStorage.setItem(`kuan-public-chat:${guardianId}:phone`, phone);
    } catch (e) {
      console.error(e);
    }
  };

  // Appointment Form States
  const [apptService, setAppointmentService] = useState("");
  const [apptStartsAt, setAppointmentStartsAt] = useState("");
  const [apptNotes, setAppointmentNotes] = useState("");
  const [apptName, setAppointmentName] = useState(visitorName);
  const [apptPhone, setAppointmentPhone] = useState(visitorPhone);
  const [apptEmail, setAppointmentEmail] = useState(visitorEmail);
  const [isApptSubmitting, setIsApptSubmitting] = useState(false);

  // Order Form States
  const [orderDesc, setOrderDescription] = useState("");
  const [orderBudget, setOrderBudget] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderName, setOrderName] = useState(visitorName);
  const [orderPhone, setOrderPhone] = useState(visitorPhone);
  const [orderEmail, setOrderEmail] = useState(visitorEmail);
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);

  // Proof Form States
  const [proofAmount, setProofAmount] = useState("");
  const [proofMethod, setProofMethod] = useState("");
  const [proofRef, setProofRef] = useState("");
  const [proofPayerNote, setProofPayerNote] = useState("");
  const [proofName, setProofName] = useState(visitorName);
  const [proofPhone, setProofPhone] = useState(visitorPhone);
  const [proofEmail, setProofEmail] = useState(visitorEmail);
  const [isProofSubmitting, setIsProofSubmitting] = useState(false);

  // Contact Form States
  const [contactName, setContactName] = useState(visitorName);
  const [contactPhone, setContactPhone] = useState(visitorPhone);
  const [contactEmail, setContactEmail] = useState(visitorEmail);

  useEffect(() => {
    setAppointmentName(visitorName);
    setAppointmentPhone(visitorPhone);
    setAppointmentEmail(visitorEmail);

    setOrderName(visitorName);
    setOrderPhone(visitorPhone);
    setOrderEmail(visitorEmail);

    setProofName(visitorName);
    setProofPhone(visitorPhone);
    setProofEmail(visitorEmail);

    setContactName(visitorName);
    setContactPhone(visitorPhone);
    setContactEmail(visitorEmail);
  }, [visitorName, visitorPhone, visitorEmail]);

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
    setSuccessMessage(null);
    try {
      const result = await sendMessage({
        data: {
          guardianId: state.guardian.slug,
          visitorKey,
          threadId: threadId ?? undefined,
          message: text,
          visitorName: visitorName || undefined,
        },
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

  // Submit Handlers
  const handleRequestAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state?.ok) return;
    if (!apptService || !apptStartsAt || !apptName || (!apptPhone && !apptEmail)) {
      setChatError("Por favor, preencha o serviço, a data/hora, seu nome e pelo menos um contato.");
      return;
    }
    setIsApptSubmitting(true);
    setChatError(null);
    setSuccessMessage(null);
    try {
      // Public clients can only create pending requests. Confirmation is guardian-only.
      const res = await requestAppointment({
        data: {
          guardianId: state.guardian.slug,
          client_name: apptName,
          client_phone: apptPhone || undefined,
          client_email: apptEmail || undefined,
          service_name: apptService,
          starts_at: apptStartsAt,
          notes: apptNotes || undefined,
          threadId: threadId ?? undefined,
          visitorKey: visitorKey ?? undefined,
        },
      });

      if (res.ok) {
        setVisitorName(apptName);
        setVisitorEmail(apptEmail);
        setVisitorPhone(apptPhone);
        saveContactInfo(apptName, apptEmail, apptPhone);

        setIsAppointmentOpen(false);
        setAppointmentService("");
        setAppointmentStartsAt("");
        setAppointmentNotes("");

        setSuccessMessage(
          "Solicitação de horário recebida. O Guardião precisa confirmar antes de o horário estar reservado.",
        );

        // Refresh conversation
        if (threadId) {
          const conversation = await getConversation({
            data: { guardianId: state.guardian.slug, visitorKey: visitorKey!, threadId },
          });
          if (conversation.ok) setMessages(conversation.messages as PublicMessage[]);
        }
      } else {
        setChatError(
          "Não consegui registrar isso agora. Nenhuma confirmação foi feita. Tente novamente em instantes ou fale diretamente com o Guardião.",
        );
      }
    } catch (err) {
      console.error(err);
      setChatError(
        "Não consegui registrar isso agora. Nenhuma confirmação foi feita. Tente novamente em instantes ou fale diretamente com o Guardião.",
      );
    } finally {
      setIsApptSubmitting(false);
    }
  };

  const handleRequestOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state?.ok) return;
    if (!orderDesc || !orderName || (!orderPhone && !orderEmail)) {
      setChatError("Por favor, preencha a descrição, seu nome e pelo menos um contato.");
      return;
    }
    setIsOrderSubmitting(true);
    setChatError(null);
    setSuccessMessage(null);
    try {
      // Public clients can only create pending requests. Confirmation is guardian-only.
      const res = await requestOrder({
        data: {
          guardianId: state.guardian.slug,
          client_name: orderName,
          client_phone: orderPhone || undefined,
          client_email: orderEmail || undefined,
          description: orderDesc,
          estimated_budget: orderBudget || undefined,
          notes: orderNotes || undefined,
          threadId: threadId ?? undefined,
          visitorKey: visitorKey ?? undefined,
        },
      });

      if (res.ok) {
        setVisitorName(orderName);
        setVisitorEmail(orderEmail);
        setVisitorPhone(orderPhone);
        saveContactInfo(orderName, orderEmail, orderPhone);

        setIsOrderOpen(false);
        setOrderDescription("");
        setOrderBudget("");
        setOrderNotes("");

        setSuccessMessage("Pedido registrado. A aceitação depende do Guardião.");

        // Refresh conversation
        if (threadId) {
          const conversation = await getConversation({
            data: { guardianId: state.guardian.slug, visitorKey: visitorKey!, threadId },
          });
          if (conversation.ok) setMessages(conversation.messages as PublicMessage[]);
        }
      } else {
        setChatError(
          "Não consegui registrar isso agora. Nenhuma confirmação foi feita. Tente novamente em instantes ou fale diretamente com o Guardião.",
        );
      }
    } catch (err) {
      console.error(err);
      setChatError(
        "Não consegui registrar isso agora. Nenhuma confirmação foi feita. Tente novamente em instantes ou fale diretamente com o Guardião.",
      );
    } finally {
      setIsOrderSubmitting(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state?.ok) return;
    if (!proofAmount || !proofName || (!proofPhone && !proofEmail)) {
      setChatError("Por favor, preencha o valor, seu nome e pelo menos um contato.");
      return;
    }
    setIsProofSubmitting(true);
    setChatError(null);
    setSuccessMessage(null);
    try {
      const parsedAmount = parseFloat(proofAmount.replace(",", "."));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setChatError("Valor de pagamento inválido.");
        setIsProofSubmitting(false);
        return;
      }

      // Public clients can only create pending requests. Confirmation is guardian-only.
      const res = await submitProof({
        data: {
          guardianId: state.guardian.slug,
          client_name: proofName,
          client_phone: proofPhone || undefined,
          client_email: proofEmail || undefined,
          amount_cents: Math.round(parsedAmount * 100),
          method: proofMethod || undefined,
          comprovante_ref: proofRef || undefined,
          payer_note: proofPayerNote || undefined,
          threadId: threadId ?? undefined,
          visitorKey: visitorKey ?? undefined,
        },
      });

      if (res.ok) {
        setVisitorName(proofName);
        setVisitorEmail(proofEmail);
        setVisitorPhone(proofPhone);
        saveContactInfo(proofName, proofEmail, proofPhone);

        setIsProofOpen(false);
        setProofAmount("");
        setProofMethod("");
        setProofRef("");
        setProofPayerNote("");

        setSuccessMessage("Comprovante recebido. O pagamento ainda depende de verificação.");

        // Refresh conversation
        if (threadId) {
          const conversation = await getConversation({
            data: { guardianId: state.guardian.slug, visitorKey: visitorKey!, threadId },
          });
          if (conversation.ok) setMessages(conversation.messages as PublicMessage[]);
        }
      } else {
        setChatError(
          "Não consegui registrar isso agora. Nenhuma confirmação foi feita. Tente novamente em instantes ou fale diretamente com o Guardião.",
        );
      }
    } catch (err) {
      console.error(err);
      setChatError(
        "Não consegui registrar isso agora. Nenhuma confirmação foi feita. Tente novamente em instantes ou fale diretamente com o Guardião.",
      );
    } finally {
      setIsProofSubmitting(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || (!contactPhone && !contactEmail)) {
      setChatError("Por favor, preencha seu nome e pelo menos um meio de contato.");
      return;
    }

    setChatError(null);
    setSuccessMessage(null);

    // Save locally
    setVisitorName(contactName);
    setVisitorEmail(contactEmail);
    setVisitorPhone(contactPhone);
    saveContactInfo(contactName, contactEmail, contactPhone);

    if (state?.ok && visitorKey) {
      try {
        const res = await submitContact({
          data: {
            guardianId: state.guardian.slug,
            visitorKey,
            threadId: threadId ?? undefined,
            client_name: contactName,
            client_phone: contactPhone || undefined,
            client_email: contactEmail || undefined,
          },
        });

        if (res.ok) {
          setIsContactOpen(false);
          setSuccessMessage(
            "Recebi seu contato e deixei registrado nesta conversa para o Guardião revisar.",
          );
          if (res.threadId) {
            setThreadId(res.threadId);
            const conversation = await getConversation({
              data: { guardianId: state.guardian.slug, visitorKey, threadId: res.threadId },
            });
            if (conversation.ok) setMessages(conversation.messages as PublicMessage[]);
          }
          return;
        }
      } catch (err) {
        console.error("Failed to submit public contact to thread:", err);
      }
    }

    // Fallback if visitorKey or thread fails
    setIsContactOpen(false);
    setSuccessMessage("Contato salvo neste navegador para preencher solicitações futuras.");
  };

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
        <div className="rounded-3xl border border-[color:var(--border)] bg-card/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-md sm:p-7">
          <Badge className="mb-3 bg-[color:oklch(0.69_0.22_350/0.22)] text-[color:var(--ivory)]">
            Página pública · Kuan-Yin
          </Badge>
          <h1 className="serif text-3xl text-[color:var(--ivory)] sm:text-4xl">{guardian.name}</h1>
          {guardian.type && (
            <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[color:var(--gold)] font-medium">
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
            Link público:{" "}
            <code className="text-[color:var(--ivory)]">{guardian.canonicalPath}</code>
          </p>
        </div>

        {!hasPublicData && (
          <Notice
            title="Chat indisponível por falta de configuração pública"
            text="O Guardião já tem uma página pública, mas ainda não publicou detalhes comerciais suficientes para orientar o atendimento."
          />
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <InfoCard title="Serviços">
            <List values={guardian.services} empty="Serviços ainda não publicados." />
          </InfoCard>
          <InfoCard title="Preços / faixas">
            <List values={guardian.prices} empty="Preços ainda não publicados." />
          </InfoCard>
          <InfoCard title="Formas de pagamento">
            <List
              values={guardian.paymentMethods}
              empty="Formas de pagamento ainda não publicadas."
            />
          </InfoCard>
          <InfoCard title="Agenda">
            <List values={guardian.scheduleRules} empty="Regras de agenda ainda não publicadas." />
          </InfoCard>
        </div>

        <div className="rounded-3xl border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 p-5 text-sm leading-relaxed text-[color:var(--ivory)]">
          <p className="font-semibold text-[color:var(--gold)]">Aviso Importante:</p>
          <p className="mt-1">
            Pedidos, agendamentos e pagamentos dependem de aprovação e confirmação manual do
            Guardião.
          </p>
          <p className="mt-2">O envio de comprovante indica apenas solicitação em análise.</p>
        </div>

        <div className="rounded-3xl border border-[color:var(--border)] bg-card/50 p-5 backdrop-blur-md">
          <h2 className="serif text-2xl text-[color:var(--ivory)]">Converse com a Kuan-Yin</h2>
          <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">
            Deixe suas dúvidas, solicite orçamentos ou faça pedidos. A Kuan-Yin orientará você e
            registrará suas solicitações como pendentes para aprovação do Guardião.
          </p>
          <div className="mt-4 min-h-40 max-h-96 overflow-y-auto space-y-3 rounded-2xl border border-[color:var(--border)] bg-background/40 p-4">
            {conversationLoading && (
              <p className="text-sm text-[color:var(--ivory-dim)]">Carregando conversa…</p>
            )}
            {!conversationLoading && messages.length === 0 && (
              <p className="text-sm text-[color:var(--ivory-dim)]">
                Sem mensagens ainda. Envie sua primeira pergunta ou clique em um dos atalhos rápidos
                abaixo!
              </p>
            )}
            {messages.map((item) => (
              <div key={item.id} className={item.role === "visitor" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${item.role === "visitor" ? "bg-[color:var(--gold)]/20 text-[color:var(--ivory)] border border-[color:var(--gold)]/15" : "bg-card text-[color:var(--ivory)] border border-[color:var(--border)]"}`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          {chatError && <p className="mt-3 text-sm text-red-400 font-medium">{chatError}</p>}
          {successMessage && (
            <p className="mt-3 text-sm text-emerald-400 font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span>{successMessage}</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setIsAppointmentOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-card/60 px-4 py-2 text-xs font-medium text-[color:var(--ivory)] hover:border-[color:var(--gold)]/50 hover:bg-card hover:shadow-[0_0_12px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              <span>📅 Agendar Horário</span>
            </button>
            <button
              onClick={() => setIsOrderOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-card/60 px-4 py-2 text-xs font-medium text-[color:var(--ivory)] hover:border-[color:var(--gold)]/50 hover:bg-card hover:shadow-[0_0_12px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              <span>📝 Pedir Orçamento</span>
            </button>
            <button
              onClick={() => setIsProofOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-card/60 px-4 py-2 text-xs font-medium text-[color:var(--ivory)] hover:border-[color:var(--gold)]/50 hover:bg-card hover:shadow-[0_0_12px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <DollarSign className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              <span>💵 Enviar Comprovante</span>
            </button>
            <button
              onClick={() => setIsContactOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-card/60 px-4 py-2 text-xs font-medium text-[color:var(--ivory)] hover:border-[color:var(--gold)]/50 hover:bg-card hover:shadow-[0_0_12px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Phone className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              <span>📞 Deixar Contato</span>
            </button>
          </div>

          <form onSubmit={handleSend} className="mt-4 space-y-3">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={3000}
              disabled={sending || conversationLoading || !hasPublicData}
              placeholder="Pergunte sobre serviços, preços, horários ou mande uma mensagem direta para a Kuan-Yin..."
              className="border-[color:var(--border)] focus-visible:ring-[color:var(--gold)] focus-visible:ring-1"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[color:var(--ivory-dim)]">
                Kuan-Yin é uma assistente. Decisões financeiras e comerciais finais são tomadas pelo
                Guardião.
              </p>
              <Button
                type="submit"
                disabled={sending || conversationLoading || !hasPublicData}
                className="bg-[color:var(--gold)]/90 hover:bg-[color:var(--gold)] text-black font-semibold rounded-full px-6 transition-all duration-200 shadow-[0_4px_20px_rgba(212,175,55,0.15)] hover:shadow-[0_4px_25px_rgba(212,175,55,0.25)]"
              >
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Dialog: Agendar Horário */}
      <Dialog open={isAppointmentOpen} onOpenChange={setIsAppointmentOpen}>
        <DialogContent className="border-[color:var(--border)] bg-card/95 backdrop-blur-lg text-[color:var(--ivory)] shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
          <DialogHeader>
            <DialogTitle className="serif text-2xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[color:var(--gold)]" />
              <span>📅 Solicitar Agendamento</span>
            </DialogTitle>
            <DialogDescription className="text-[color:var(--ivory-dim)] text-xs">
              Deixe sua solicitação de horário. Ela ficará pendente de aprovação e confirmação
              manual do Guardião.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestAppointment} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="appt-name" className="text-xs text-[color:var(--ivory-dim)]">
                  Seu Nome *
                </Label>
                <Input
                  id="appt-name"
                  value={apptName}
                  onChange={(e) => setAppointmentName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appt-phone" className="text-xs text-[color:var(--ivory-dim)]">
                  Telefone *
                </Label>
                <Input
                  id="appt-phone"
                  value={apptPhone}
                  onChange={(e) => setAppointmentPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="appt-email" className="text-xs text-[color:var(--ivory-dim)]">
                E-mail
              </Label>
              <Input
                id="appt-email"
                type="email"
                value={apptEmail}
                onChange={(e) => setAppointmentEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="appt-service" className="text-xs text-[color:var(--ivory-dim)]">
                  Serviço *
                </Label>
                <Input
                  id="appt-service"
                  value={apptService}
                  onChange={(e) => setAppointmentService(e.target.value)}
                  placeholder="Ex: Consulta, Mentoria, etc."
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appt-time" className="text-xs text-[color:var(--ivory-dim)]">
                  Data e Hora *
                </Label>
                <Input
                  id="appt-time"
                  type="datetime-local"
                  value={apptStartsAt}
                  onChange={(e) => setAppointmentStartsAt(e.target.value)}
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="appt-notes" className="text-xs text-[color:var(--ivory-dim)]">
                Observações (opcional)
              </Label>
              <Textarea
                id="appt-notes"
                value={apptNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="Deseja deixar algum detalhe ou preferência especial?"
                rows={2}
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <p className="text-[10px] text-[color:var(--ivory-dim)] leading-snug">
              * Ao clicar em enviar, os contatos serão guardados localmente para facilitar novas
              solicitações.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAppointmentOpen(false)}
                className="border-[color:var(--border)] hover:bg-card/50 rounded-full"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isApptSubmitting}
                className="bg-[color:var(--gold)] hover:bg-[color:var(--gold)]/80 text-black font-semibold rounded-full px-6"
              >
                {isApptSubmitting ? "Enviando…" : "Enviar Solicitação"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pedir Orçamento */}
      <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
        <DialogContent className="border-[color:var(--border)] bg-card/95 backdrop-blur-lg text-[color:var(--ivory)] shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
          <DialogHeader>
            <DialogTitle className="serif text-2xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-[color:var(--gold)]" />
              <span>📝 Solicitar Orçamento/Pedido</span>
            </DialogTitle>
            <DialogDescription className="text-[color:var(--ivory-dim)] text-xs">
              Descreva detalhadamente o que você precisa. O Guardião analisará a viabilidade e
              entrará em contato.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestOrder} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="order-name" className="text-xs text-[color:var(--ivory-dim)]">
                  Seu Nome *
                </Label>
                <Input
                  id="order-name"
                  value={orderName}
                  onChange={(e) => setOrderName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="order-phone" className="text-xs text-[color:var(--ivory-dim)]">
                  Telefone *
                </Label>
                <Input
                  id="order-phone"
                  value={orderPhone}
                  onChange={(e) => setOrderPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="order-email" className="text-xs text-[color:var(--ivory-dim)]">
                E-mail
              </Label>
              <Input
                id="order-email"
                type="email"
                value={orderEmail}
                onChange={(e) => setOrderEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="order-desc" className="text-xs text-[color:var(--ivory-dim)]">
                Descrição Detalhada do Pedido *
              </Label>
              <Textarea
                id="order-desc"
                value={orderDesc}
                onChange={(e) => setOrderDescription(e.target.value)}
                placeholder="Descreva aqui o serviço ou produto que você deseja orçar..."
                required
                rows={3}
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="order-budget" className="text-xs text-[color:var(--ivory-dim)]">
                Orçamento Estimado (Opcional)
              </Label>
              <Input
                id="order-budget"
                value={orderBudget}
                onChange={(e) => setOrderBudget(e.target.value)}
                placeholder="Ex: R$ 500,00 ou R$ 1.000,00"
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="order-notes" className="text-xs text-[color:var(--ivory-dim)]">
                Notas adicionais (opcional)
              </Label>
              <Input
                id="order-notes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Ex: Prazo desejado, urgência..."
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOrderOpen(false)}
                className="border-[color:var(--border)] hover:bg-card/50 rounded-full"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isOrderSubmitting}
                className="bg-[color:var(--gold)] hover:bg-[color:var(--gold)]/80 text-black font-semibold rounded-full px-6"
              >
                {isOrderSubmitting ? "Enviando…" : "Enviar Orçamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Enviar Comprovante */}
      <Dialog open={isProofOpen} onOpenChange={setIsProofOpen}>
        <DialogContent className="border-[color:var(--border)] bg-card/95 backdrop-blur-lg text-[color:var(--ivory)] shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
          <DialogHeader>
            <DialogTitle className="serif text-2xl flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[color:var(--gold)]" />
              <span>💵 Notificar Pagamento / Enviar Comprovante</span>
            </DialogTitle>
            <DialogDescription className="text-[color:var(--ivory-dim)] text-xs">
              Informe os dados do seu pagamento pendente. O Guardião confirmará os valores para
              concluir a transação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitProof} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="proof-name" className="text-xs text-[color:var(--ivory-dim)]">
                  Seu Nome *
                </Label>
                <Input
                  id="proof-name"
                  value={proofName}
                  onChange={(e) => setProofName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proof-phone" className="text-xs text-[color:var(--ivory-dim)]">
                  Telefone *
                </Label>
                <Input
                  id="proof-phone"
                  value={proofPhone}
                  onChange={(e) => setProofPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="proof-email" className="text-xs text-[color:var(--ivory-dim)]">
                E-mail
              </Label>
              <Input
                id="proof-email"
                type="email"
                value={proofEmail}
                onChange={(e) => setProofEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="proof-amount" className="text-xs text-[color:var(--ivory-dim)]">
                  Valor Pago (BRL) *
                </Label>
                <Input
                  id="proof-amount"
                  value={proofAmount}
                  onChange={(e) => setProofAmount(e.target.value)}
                  placeholder="Ex: 150.00"
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="proof-method" className="text-xs text-[color:var(--ivory-dim)]">
                  Forma de Pagamento
                </Label>
                <Input
                  id="proof-method"
                  value={proofMethod}
                  onChange={(e) => setProofMethod(e.target.value)}
                  placeholder="Pix, TED, Cartão..."
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="proof-ref" className="text-xs text-[color:var(--ivory-dim)]">
                Ref / ID Transação / Código do Comprovante
              </Label>
              <Input
                id="proof-ref"
                value={proofRef}
                onChange={(e) => setProofRef(e.target.value)}
                placeholder="Ex: TxID Pix, código de autenticação..."
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="proof-note" className="text-xs text-[color:var(--ivory-dim)]">
                Nota Adicional / Informações Úteis
              </Label>
              <Textarea
                id="proof-note"
                value={proofPayerNote}
                onChange={(e) => setProofPayerNote(e.target.value)}
                placeholder="Ex: Pago da conta da minha mãe, etc."
                rows={2}
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <p className="text-[10px] text-[color:var(--gold)] leading-snug">
              Nota: "Public clients can only create pending requests. Confirmation is
              guardian-only."
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProofOpen(false)}
                className="border-[color:var(--border)] hover:bg-card/50 rounded-full"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isProofSubmitting}
                className="bg-[color:var(--gold)] hover:bg-[color:var(--gold)]/80 text-black font-semibold rounded-full px-6"
              >
                {isProofSubmitting ? "Enviando…" : "Notificar Pagamento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Deixar Contato */}
      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="border-[color:var(--border)] bg-card/95 backdrop-blur-lg text-[color:var(--ivory)] shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
          <DialogHeader>
            <DialogTitle className="serif text-2xl flex items-center gap-2">
              <Phone className="h-5 w-5 text-[color:var(--gold)]" />
              <span>📞 Deixar Dados de Contato</span>
            </DialogTitle>
            <DialogDescription className="text-[color:var(--ivory-dim)] text-xs">
              Sintonize seus contatos. Eles serão salvos localmente para preenchimento rápido em
              todas as ações públicas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveContact} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label htmlFor="contact-name" className="text-xs text-[color:var(--ivory-dim)]">
                Seu Nome completo *
              </Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Pedro Silva"
                required
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="contact-phone" className="text-xs text-[color:var(--ivory-dim)]">
                Telefone Celular *
              </Label>
              <Input
                id="contact-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="contact-email" className="text-xs text-[color:var(--ivory-dim)]">
                E-mail
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="bg-background/50 border-[color:var(--border)] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsContactOpen(false)}
                className="border-[color:var(--border)] hover:bg-card/50 rounded-full"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[color:var(--gold)] hover:bg-[color:var(--gold)]/80 text-black font-semibold rounded-full px-6"
              >
                Salvar Contatos
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-[color:var(--ivory)] font-sans antialiased">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <img
            src={kuanyinApple.url}
            alt=""
            className="h-7 w-7"
            style={{ filter: "drop-shadow(0 0 8px rgba(236,72,153,0.45))" }}
          />
          <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--ivory-dim)] font-semibold">
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
    <div className="rounded-3xl border border-[color:var(--border)] bg-card/45 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-sm">
      <h2 className="serif mb-4 text-xl text-[color:var(--ivory)]">{title}</h2>
      {children}
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-card/50 p-5 shadow-lg backdrop-blur-sm">
      <h1 className="serif text-xl text-[color:var(--ivory)]">{title}</h1>
      <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">{text}</p>
    </div>
  );
}

function List({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) return <p className="text-sm text-[color:var(--ivory-dim)]">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-[color:var(--ivory)]">
      {values.map((value) => (
        <li key={value} className="flex items-start gap-1.5">
          <span className="text-[color:var(--gold)] mt-0.5">•</span>
          <span>{value}</span>
        </li>
      ))}
    </ul>
  );
}
