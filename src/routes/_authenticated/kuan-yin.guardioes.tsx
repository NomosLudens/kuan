import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createKuanYinGuardianInvite,
  getKuanYinPublicConversation,
  listKuanYinGuardians,
  listKuanYinPublicConversations,
  updateKuanYinGuardianStatus,
} from "@/lib/kuanyin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Copy, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kuan-yin/guardioes")({
  component: GuardioesPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type GuardianStatus = "draft" | "published" | "suspended" | "archived";

type PublicConversationRow = {
  id: string;
  guardian_id: string;
  guardian_name: string | null;
  guardian_slug: string | null;
  visitor_name: string | null;
  visitor_key: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type PublicConversationMessage = {
  id: string;
  role: "visitor" | "kuanyin";
  content: string;
  created_at: string;
};

type PublicConversationDetail = {
  thread: PublicConversationRow;
  messages: PublicConversationMessage[];
};

type GuardianRow = {
  id: string;
  user_id: string;
  admin_user_id: string | null;
  business_context_id: string;
  public_slug: string;
  status: GuardianStatus;
  created_at: string;
  updated_at: string;
  business_contexts: { nome: string; tipo: string | null; updated_at: string } | null;
  is_owner?: boolean;
};

const STATUS_LABEL: Record<GuardianStatus, string> = {
  draft: "rascunho",
  published: "publicado",
  suspended: "suspenso",
  archived: "arquivado",
};

const STATUS_HELP: Record<GuardianStatus, string> = {
  draft: "A página pública fica fora do ar até ser publicada.",
  published: "Clientes finais podem acessar a página pública.",
  suspended: "O admin bloqueia temporariamente a presença pública.",
  archived: "A presença fica encerrada e invisível ao público.",
};

function GuardioesPage() {
  const listFn = useServerFn(listKuanYinGuardians);
  const listConversationsFn = useServerFn(listKuanYinPublicConversations);
  const getConversationFn = useServerFn(getKuanYinPublicConversation);
  const updateStatusFn = useServerFn(updateKuanYinGuardianStatus);
  const inviteFn = useServerFn(createKuanYinGuardianInvite);
  const [rows, setRows] = useState<GuardianRow[]>([]);
  const [conversations, setConversations] = useState<PublicConversationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<PublicConversationDetail | null>(
    null,
  );
  const [conversationBusy, setConversationBusy] = useState<string | null>(null);

  const publishedCount = useMemo(
    () => rows.filter((row) => row.status === "published").length,
    [rows],
  );

  async function reload() {
    setLoading(true);
    try {
      const [guardianRows, conversationRows] = await Promise.all([listFn(), listConversationsFn()]);
      setRows(guardianRows as GuardianRow[]);
      setConversations(conversationRows as PublicConversationRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar Guardiões.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(id: string, status: GuardianStatus) {
    if (status === "suspended" || status === "archived") {
      const ok = confirm(
        status === "suspended"
          ? "Suspender esta página pública agora? Clientes finais deixarão de acessá-la."
          : "Arquivar esta presença pública? Ela ficará invisível para clientes finais.",
      );
      if (!ok) return;
    }
    try {
      await updateStatusFn({ data: { id, status } });
      toast.success(`Guardião ${STATUS_LABEL[status]}.`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar status.");
    }
  }

  async function openConversation(threadId: string) {
    setConversationBusy(threadId);
    try {
      const detail = (await getConversationFn({ data: { threadId } })) as PublicConversationDetail;
      setSelectedConversation(detail);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao abrir conversa.");
    } finally {
      setConversationBusy(null);
    }
  }

  async function createInvite() {
    setInviteLink(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setInviteBusy(true);
    try {
      const res = (await inviteFn({
        data: { email: email.trim(), origin: window.location.origin },
      })) as { shareLink: string; emailSent: boolean };
      setInviteLink(res.shareLink);
      setEmail("");
      toast.success(res.emailSent ? "Convite enviado por e-mail." : "Convite criado para copiar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar convite.");
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-4">
      <section className="rounded-3xl border border-[color:var(--border)] bg-card/60 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="mb-3 bg-[color:oklch(0.69_0.22_350/0.22)] text-[color:var(--ivory)]">
              Guardiões do Negócio
            </Badge>
            <h1 className="serif text-3xl text-[color:var(--ivory)]">
              Presenças públicas Kuan-Yin
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--ivory-dim)]">
              Gerencie os Guardiões vinculados a você, publique ou suspenda páginas públicas e
              convide novos clientes do admin para configurar a própria Kuan-Yin comercial.
            </p>
            <p className="mt-3 text-xs text-[color:var(--ivory-dim)]">
              {rows.length} Guardião(ões) encontrados · {publishedCount} publicado(s)
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-background/50 p-3 lg:w-80">
            <div className="mb-2 flex items-center gap-2 text-sm text-[color:var(--ivory)]">
              <Mail className="h-4 w-4 text-[color:var(--gold)]" aria-hidden />
              Convidar Guardião
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@negocio.com"
              />
              <Button disabled={inviteBusy} onClick={createInvite}>
                {inviteBusy ? "..." : "Convidar"}
              </Button>
            </div>
            {inviteLink && (
              <button
                type="button"
                className="mt-2 w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-left text-xs text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)]"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteLink).catch(() => {});
                  toast.success("Link copiado.");
                }}
              >
                <Copy className="mr-2 inline h-3.5 w-3.5" aria-hidden />
                Copiar link de convite
              </button>
            )}
          </div>
        </div>
      </section>

      {loading && <p className="text-sm text-[color:var(--ivory-dim)]">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <section className="rounded-2xl border border-[color:var(--border)] bg-card/40 p-5">
          <ShieldCheck className="mb-3 h-5 w-5 text-[color:var(--gold)]" aria-hidden />
          <h2 className="serif text-xl text-[color:var(--ivory)]">Nenhum Guardião ainda</h2>
          <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">
            Convide um Guardião ou configure seu próprio negócio na aba Negócio para publicar a
            primeira presença pública.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-[color:var(--border)] bg-card/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="serif text-xl text-[color:var(--ivory)]">Conversas públicas recentes</h2>
          <Badge variant="outline">{conversations.length}</Badge>
        </div>
        {conversations.length === 0 ? (
          <p className="text-sm text-[color:var(--ivory-dim)]">
            Nenhuma conversa pública persistida ainda. Quando clientes conversarem pela página
            pública, elas aparecerão aqui.
          </p>
        ) : (
          <div className="grid gap-2">
            {conversations.slice(0, 8).map((conversation) => (
              <div
                key={conversation.id}
                className="rounded-xl border border-[color:var(--border)] bg-background/40 px-3 py-2"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[color:var(--ivory)]">
                      {conversation.visitor_name || "Visitante sem nome"}
                    </p>
                    <p className="truncate text-xs text-[color:var(--ivory-dim)]">
                      {conversation.guardian_name ?? conversation.guardian_slug ?? "Guardião"} ·
                      atualizada em {new Date(conversation.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{conversation.status}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={conversationBusy === conversation.id}
                      onClick={() => openConversation(conversation.id)}
                    >
                      {conversationBusy === conversation.id ? "Abrindo…" : "Abrir"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedConversation && (
          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-background/50 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="serif text-lg text-[color:var(--ivory)]">
                  {selectedConversation.thread.visitor_name || "Visitante sem nome"}
                </h3>
                <p className="text-xs text-[color:var(--ivory-dim)]">
                  {selectedConversation.thread.guardian_name ??
                    selectedConversation.thread.guardian_slug ??
                    "Guardião"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedConversation(null)}>
                Fechar
              </Button>
            </div>
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {selectedConversation.messages.length === 0 ? (
                <p className="text-sm text-[color:var(--ivory-dim)]">
                  Sem mensagens nessa conversa.
                </p>
              ) : (
                selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "visitor" ? "text-right" : "text-left"}
                  >
                    <div
                      className={
                        (message.role === "visitor" ? "bg-[color:var(--gold)]/20" : "bg-card") +
                        " inline-block max-w-[88%] rounded-2xl px-3 py-2 text-sm text-[color:var(--ivory)]"
                      }
                    >
                      <p>{message.content}</p>
                      <p className="mt-1 text-[10px] text-[color:var(--ivory-dim)]">
                        {new Date(message.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-3">
        {rows.map((guardian) => {
          const publicPath = `/g/${guardian.public_slug}`;
          const publicUrl =
            typeof window === "undefined" ? publicPath : `${window.location.origin}${publicPath}`;
          return (
            <article
              key={guardian.id}
              className="rounded-2xl border border-[color:var(--border)] bg-card/50 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="serif text-xl text-[color:var(--ivory)]">
                      {guardian.business_contexts?.nome ?? "Guardião sem nome"}
                    </h2>
                    <Badge variant="outline">{STATUS_LABEL[guardian.status]}</Badge>
                    {guardian.business_contexts?.tipo && (
                      <Badge variant="secondary">{guardian.business_contexts.tipo}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
                    Link público: <code className="text-[color:var(--ivory)]">{publicPath}</code>
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--ivory-dim)]">
                    {STATUS_HELP[guardian.status]}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button asChild variant="outline" size="sm">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      Abrir <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                    </a>
                  </Button>
                  {guardian.is_owner ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/kuan-yin/config">Editar negócio</Link>
                    </Button>
                  ) : (
                    <Badge variant="secondary">Gerenciado pelo admin</Badge>
                  )}
                  {(["draft", "published", "suspended", "archived"] as GuardianStatus[]).map(
                    (status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={guardian.status === status ? "default" : "outline"}
                        disabled={guardian.status === status}
                        onClick={() => updateStatus(guardian.id, status)}
                      >
                        {STATUS_LABEL[status]}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
