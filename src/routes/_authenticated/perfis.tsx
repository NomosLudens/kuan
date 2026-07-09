import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  createInvite,
  removeMember,
  revokeInvite,
  updateMemberModules,
  saveInitialContext,
  getMemberInitialContext,
  getAdminMetrics,
  type AdminMetrics,
} from "@/lib/perfis.functions";
import { importarContextoMembro } from "@/lib/admin-import.functions";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/perfis";
import { KittDebug } from "@/components/KittDebug";
import { CHAT_MODELS, useChatModel } from "@/lib/use-chat-model";
import {
  STT_FALLBACK_MODEL_KEY,
  STT_MODEL_KEY,
  STT_MODELS,
  isSTTModel,
  type STTModel,
} from "@/lib/stt-models";
import { TTS_MODEL_KEY, TTS_MODELS, TTS_VOICE_KEY, TTS_VOICES, type TTSModel } from "@/lib/use-tts";
import {
  ArrowLeft,
  Check,
  Copy,
  Mail,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
  AlertTriangle,
  MessageSquare,
  UserCircle,
  BookOpen,
} from "lucide-react";

import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/perfis")({
  component: PerfisPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type Member = {
  id: string;
  member_id: string;
  modules: string[];
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
};

type Invite = {
  id: string;
  email: string;
  modules: string[];
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
};

function PerfisPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ownerOfMe, setOwnerOfMe] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const createFn = useServerFn(createInvite);
  const revokeFn = useServerFn(revokeInvite);
  const updateFn = useServerFn(updateMemberModules);
  const removeFn = useServerFn(removeMember);
  const importContextoFn = useServerFn(importarContextoMembro);
  const metricsFn = useServerFn(getAdminMetrics);

  const reload = useCallback(async (uid: string) => {
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from("workspace_members")
        .select(
          "id, member_id, modules, created_at, profile:profiles!workspace_members_member_id_fkey(display_name, avatar_url)",
        )
        .eq("owner_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("workspace_invitations")
        .select("id, email, modules, status, token, expires_at, created_at")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (invitesRes.error) throw new Error(invitesRes.error.message);
    setMembers((membersRes.data ?? []) as unknown as Member[]);
    setInvites((invitesRes.data ?? []) as Invite[]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoadError(null);
        const { data: userRes, error: userError } = await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);
        const uid = userRes.user?.id ?? null;
        setUserId(uid);
        if (!uid) return;

        const { data: own, error: ownError } = await supabase
          .from("workspace_members")
          .select("owner_id")
          .eq("member_id", uid)
          .maybeSingle();
        if (ownError) throw new Error(ownError.message);
        const admin = !own;
        setOwnerOfMe(own?.owner_id ?? null);
        setIsAdmin(admin);

        if (admin) {
          await reload(uid);
          const m = await metricsFn({});
          setMetrics(m);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar Guardião.");
      } finally {
        setMetricsLoading(false);
        setLoading(false);
      }
    })();
  }, [reload, metricsFn]);

  if (loading)
    return (
      <Shell>
        <p className="text-[#F3EBDD]/60">Carregando…</p>
      </Shell>
    );

  if (loadError) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[#BE123C]/30 bg-[#BE123C]/10 p-6 space-y-3">
          <AlertTriangle className="w-6 h-6 text-[#FB7185]" />
          <h2 className="serif text-xl">Falha ao carregar Guardião</h2>
          <p className="text-sm text-[#F3EBDD]/70">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-10 px-4 rounded-md bg-[#C98A65] text-[#08080E] text-sm font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell>
        <div className="rounded-2xl border border-white/5 bg-[#111016] p-6 space-y-3">
          <ShieldCheck className="w-6 h-6 text-[#D9A441]" />
          <h2 className="serif text-xl">Você participa de um workspace</h2>
          <p className="text-sm text-[#F3EBDD]/70">
            Esta conta é um perfil convidado. Quem administra é{" "}
            {ownerOfMe ? (
              <code className="text-[#D9A441]">{ownerOfMe.slice(0, 8)}…</code>
            ) : (
              "o admin"
            )}{" "}
            e ele controla os módulos que você acessa.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8">
        {/* Métricas */}
        {metrics && !metricsLoading && (
          <>
            <section>
              <h2 className="text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/50 mb-3">
                Resumo do workspace
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <MetricCard label="Perfis ativos" value={metrics.activeProfiles} icon={Users} />
                <MetricCard label="Convites pendentes" value={metrics.pendingInvites} icon={Mail} />
                <MetricCard
                  label="Mensagens hoje"
                  value={metrics.messagesToday}
                  icon={MessageSquare}
                />
                <MetricCard
                  label="Mensagens 7 dias"
                  value={metrics.messagesWeek}
                  icon={MessageSquare}
                />
                <MetricCard
                  label="Sem contexto inicial"
                  value={metrics.withoutContext}
                  icon={AlertTriangle}
                />
                {Object.entries(metrics.profilesByFacet).map(([facet, count]) => (
                  <MetricCard
                    key={facet}
                    label={`Faceta: ${facet}`}
                    value={count}
                    icon={UserCircle}
                  />
                ))}
              </div>
            </section>

            {/* Usuários que precisam de atenção */}
            <AttentionSection members={members} userId={userId!} />
          </>
        )}

        <GuardianModelSettings />

        <KittDebugSection userId={userId!} />

        <InviteForm
          userId={userId!}
          onCreated={async () => {
            if (userId) {
              await reload(userId);
              const m = await metricsFn({});
              setMetrics(m);
            }
          }}
          createFn={createFn}
        />

        <section>
          <h2 className="text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/50 mb-3 inline-flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Perfis ativos
          </h2>
          {members.length === 0 ? (
            <p className="text-xs text-[#F3EBDD]/55 italic">
              Ninguém ainda. Use o formulário acima para convidar.
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onUpdate={async (mods) => {
                    await updateFn({ data: { memberId: m.member_id, modules: mods } });
                    if (userId) await reload(userId);
                  }}
                  onRemove={async () => {
                    if (!confirm(`Remover acesso de ${m.profile?.display_name ?? "este perfil"}?`))
                      return;
                    await removeFn({ data: { memberId: m.member_id } });
                    if (userId) await reload(userId);
                  }}
                  onImportContexto={async (input) => {
                    await importContextoFn({ data: { memberId: m.member_id, ...input } });
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/50 mb-3 inline-flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" /> Convites
          </h2>
          {invites.length === 0 ? (
            <p className="text-xs text-[#F3EBDD]/55 italic">Sem convites.</p>
          ) : (
            <ul className="space-y-2">
              {invites.map((i) => (
                <InviteRow
                  key={i.id}
                  invite={i}
                  onRevoke={async () => {
                    await revokeFn({ data: { id: i.id } });
                    if (userId) await reload(userId);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#111016] p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#F3EBDD]/50">
        <Icon className="w-3 h-3" />
        <span className="truncate">{label}</span>
      </div>
      <p className="serif text-2xl text-[#D9A441]">{value}</p>
    </div>
  );
}

// ─── AttentionSection ─────────────────────────────────────────────

function AttentionSection({ members, userId }: { members: Member[]; userId: string }) {
  const [profilesWithFacet, setProfilesWithFacet] = useState<
    Array<{ member_id: string; assigned_facet: string | null; display_name: string | null }>
  >([]);

  useEffect(() => {
    if (members.length === 0) return;
    const memberIds = members.map((m) => m.member_id);
    if (memberIds.length === 0) return;

    supabase
      .from("profiles")
      .select("id, display_name, assigned_facet")
      .in("id", memberIds)
      .then(({ data }) => {
        if (data) {
          setProfilesWithFacet(
            data.map((p) => ({
              member_id: p.id,
              assigned_facet: p.assigned_facet ?? null,
              display_name: p.display_name,
            })),
          );
        }
      });
  }, [members]);

  // Filtra quem precisa de atenção
  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      reason: string;
      name: string;
    }> = [];

    for (const p of profilesWithFacet) {
      if (!p.assigned_facet) {
        items.push({
          id: p.member_id,
          reason: "Sem faceta atribuída",
          name: p.display_name ?? p.member_id.slice(0, 8),
        });
      }
    }

    return items;
  }, [profilesWithFacet]);

  if (attentionItems.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[#D9A441]/20 bg-[#D9A441]/5 p-4 sm:p-5 space-y-3">
      <h2 className="text-[10px] uppercase tracking-[0.28em] text-[#D9A441] inline-flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5" /> Usuários que precisam de atenção
      </h2>
      <ul className="space-y-2">
        {attentionItems.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 text-sm border-b border-white/5 pb-2 last:border-b-0"
          >
            <span className="text-[#D9A441]">{item.name}</span>
            <span className="text-[11px] text-[#F3EBDD]/55">— {item.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Shell ────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#08080E] text-[#F3EBDD]">
      <header className="border-b border-white/5 sticky top-0 z-20 bg-[#08080E]/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/klio" aria-label="Voltar" className="text-[#F3EBDD]/60 hover:text-[#D9A441]">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="leading-tight">
            <div className="serif text-[#D9A441] text-base tracking-[0.18em]">GUARDIÃO</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#F3EBDD]/50">
              operação da IA · modelos · acesso
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function GuardianModelSettings() {
  const [model, setModel] = useState<TTSModel>(() => {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(TTS_MODEL_KEY);
    return TTS_MODELS.includes(saved as TTSModel) ? (saved as TTSModel) : TTS_MODELS[0];
  });
  const [voice, setVoice] = useState(() => {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(TTS_VOICE_KEY);
    const options = TTS_VOICES[model];
    return options.find((v) => v.value === saved)?.value ?? options[0].value;
  });

  const { activeChatModel, setActiveChatModel } = useChatModel();
  const [sttModel, setSttModel] = useState<STTModel>(() => {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(STT_MODEL_KEY);
    return isSTTModel(saved) ? saved : STT_MODELS[0];
  });
  const [sttFallback, setSttFallback] = useState<STTModel>(() => {
    const saved =
      typeof localStorage === "undefined" ? null : localStorage.getItem(STT_FALLBACK_MODEL_KEY);
    return isSTTModel(saved) ? saved : "openai/whisper-large-v3";
  });

  return (
    <section className="rounded-2xl border border-white/5 bg-[#111016] p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/55">
          Modelos da Kaline
        </h2>
        <p className="mt-1 text-xs text-[#F3EBDD]/55">
          Configuração operacional da IA controlada pelo Guardião.
        </p>
      </div>
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/55">
          Chat · modelo
        </label>
        <select
          value={activeChatModel ?? CHAT_MODELS[0]}
          onChange={(e) => setActiveChatModel(e.target.value as (typeof CHAT_MODELS)[number])}
          className="h-9 w-full rounded-md border border-white/10 bg-[#0B0A10] px-3 text-xs outline-none focus:border-[#D9A441]"
        >
          {CHAT_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/55">
          TTS · modelo
        </label>
        <select
          value={model}
          onChange={(e) => {
            const next = e.target.value as TTSModel;
            setModel(next);
            localStorage.setItem(TTS_MODEL_KEY, next);
            const nextVoice = TTS_VOICES[next][0].value;
            setVoice(nextVoice);
            localStorage.setItem(TTS_VOICE_KEY, nextVoice);
          }}
          className="h-9 w-full rounded-md border border-white/10 bg-[#0B0A10] px-3 text-xs outline-none focus:border-[#D9A441]"
        >
          {TTS_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/55">
          TTS · voz
        </label>
        <select
          value={voice}
          onChange={(e) => {
            const next = e.target.value;
            setVoice(next);
            localStorage.setItem(TTS_VOICE_KEY, next);
          }}
          className="h-9 w-full rounded-md border border-white/10 bg-[#0B0A10] px-3 text-xs outline-none focus:border-[#D9A441]"
        >
          {TTS_VOICES[model].map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["STT · modelo", sttModel, STT_MODEL_KEY, setSttModel],
          ["STT · fallback", sttFallback, STT_FALLBACK_MODEL_KEY, setSttFallback],
        ].map(([label, value, key, setter]) => (
          <label key={key as string} className="space-y-2">
            <span className="block text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/55">
              {label as string}
            </span>
            <select
              value={value as string}
              onChange={(e) => {
                const next = e.target.value;
                if (!isSTTModel(next)) return;
                (setter as React.Dispatch<React.SetStateAction<STTModel>>)(next);
                localStorage.setItem(key as string, next);
              }}
              className="h-9 w-full rounded-md border border-white/10 bg-[#0B0A10] px-3 text-xs outline-none focus:border-[#D9A441]"
            >
              {STT_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

// ─── KittDebugSection ─────────────────────────────────────────────

function KittDebugSection({ userId }: { userId: string | null }) {
  void userId;
  return (
    <section className="rounded-2xl border border-white/5 bg-[#111016] p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#F3EBDD]/55 mb-3">
        KITT · debug (admin)
      </p>
      <KittDebug />
    </section>
  );
}

// ─── InviteForm ───────────────────────────────────────────────────

function InviteForm({
  userId,
  onCreated,
  createFn,
}: {
  userId: string;
  onCreated: () => Promise<void>;
  createFn: (args: {
    data: { email: string; modules: ModuleKey[]; origin: string };
  }) => Promise<{ acceptUrl: string; shareLink: string; emailSent: boolean }>;
}) {
  void userId;
  const [email, setEmail] = useState("");
  const [mods, setMods] = useState<Set<ModuleKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ link: string; emailSent: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggleMod(k: ModuleKey) {
    setMods((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function submit() {
    setErr(null);
    setResult(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErr("E-mail inválido.");
      return;
    }
    if (mods.size === 0) {
      setErr("Escolha pelo menos um módulo.");
      return;
    }
    setBusy(true);
    try {
      const r = await createFn({
        data: { email: email.trim(), modules: [...mods], origin: window.location.origin },
      });
      setResult({ link: r.shareLink, emailSent: r.emailSent });
      setEmail("");
      setMods(new Set());
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao criar convite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-[#111016] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-[#D9A441]" />
        <h2 className="serif text-lg">Convidar novo perfil</h2>
      </div>
      <p className="text-xs text-[#F3EBDD]/60">
        O convidado recebe um e-mail, cria a conta dele e passa a ver no app só os módulos que você
        marcar.
      </p>
      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-[0.22em] text-[#F3EBDD]/50">
          E-mail
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pessoa@exemplo.com"
          className="w-full bg-[#0B0A10] border border-white/10 rounded-md h-10 px-3 text-sm outline-none focus:border-[#C98A65]"
        />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#F3EBDD]/50">
          Módulos liberados
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {MODULE_KEYS.map((k) => {
            const checked = mods.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleMod(k)}
                className={
                  "text-left rounded-lg border px-3 py-2 transition " +
                  (checked
                    ? "border-[#C98A65] bg-[#C98A65]/10"
                    : "border-white/5 hover:border-[#C98A65]/40")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[#F3EBDD]">{MODULE_LABELS[k].title}</p>
                  {checked && <Check className="w-4 h-4 text-[#C98A65]" />}
                </div>
                <p className="text-[11px] text-[#F3EBDD]/55 mt-0.5">{MODULE_LABELS[k].descricao}</p>
              </button>
            );
          })}
        </div>
      </div>
      {err && <p className="text-xs text-[#BE123C]">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="h-10 px-4 rounded-md bg-[#C98A65] text-[#08080E] text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
      >
        <Mail className="w-4 h-4" /> {busy ? "Enviando…" : "Enviar convite"}
      </button>

      {result && <InviteCreatedBanner link={result.link} emailSent={result.emailSent} />}
    </section>
  );
}

function InviteCreatedBanner({ link, emailSent }: { link: string; emailSent: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-[#D9A441]/40 bg-[#D9A441]/5 p-3 space-y-2">
      <p className="text-xs text-[#D9A441]">
        {emailSent
          ? "E-mail enviado. Se o convidado não receber, mande o link abaixo:"
          : "O convidado já tem conta. Envie este link manualmente:"}
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          className="flex-1 bg-[#0B0A10] border border-white/10 rounded-md h-9 px-2 text-xs text-[#F3EBDD]/80 outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="h-9 px-3 rounded-md border border-white/10 hover:border-[#C98A65] text-xs text-[#F3EBDD]/80 inline-flex items-center gap-1"
        >
          <Copy className="w-3.5 h-3.5" /> {copied ? "copiado" : "copiar"}
        </button>
      </div>
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────

function MemberRow({
  member,
  onUpdate,
  onRemove,
  onImportContexto,
}: {
  member: Member;
  onUpdate: (mods: ModuleKey[]) => Promise<void>;
  onRemove: () => Promise<void>;
  onImportContexto: (input: {
    titulo: string;
    conteudo: string;
    tipo: "identidade" | "memoria_relacional";
  }) => Promise<void>;
}) {
  const [importing, setImporting] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const initial = useMemo(
    () =>
      new Set(
        member.modules.filter((m): m is ModuleKey =>
          (MODULE_KEYS as readonly string[]).includes(m),
        ),
      ),
    [member.modules],
  );
  const [draft, setDraft] = useState<Set<ModuleKey>>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const name = member.profile?.display_name ?? member.member_id.slice(0, 8);

  return (
    <li className="rounded-xl border border-white/5 bg-[#111016] p-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#C98A65]/20 text-[#C98A65] text-sm font-medium flex items-center justify-center shrink-0">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#F3EBDD] truncate">{name}</p>
          <p className="text-[10px] text-[#F3EBDD]/45">
            entrou em {new Date(member.created_at).toLocaleDateString("pt-BR")}
            {" · "}
            <code className="text-[#D9A441]/70">{member.member_id.slice(0, 8)}…</code>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {editing ? (
              MODULE_KEYS.map((k) => {
                const on = draft.has(k);
                return (
                  <button
                    key={k}
                    onClick={() =>
                      setDraft((p) => {
                        const n = new Set(p);
                        if (n.has(k)) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                    className={
                      "text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded border " +
                      (on
                        ? "border-[#C98A65] bg-[#C98A65]/15 text-[#C98A65]"
                        : "border-white/10 text-[#F3EBDD]/55")
                    }
                  >
                    {MODULE_LABELS[k].title}
                  </button>
                );
              })
            ) : member.modules.length === 0 ? (
              <span className="text-[11px] text-[#F3EBDD]/45 italic">sem módulos liberados</span>
            ) : (
              member.modules.map((m) => (
                <span
                  key={m}
                  className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded bg-[#C98A65]/10 text-[#C98A65]"
                >
                  {MODULE_LABELS[m as ModuleKey]?.title ?? m}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex items-start gap-1">
          {editing ? (
            <>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onUpdate([...draft]);
                    setEditing(false);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="text-xs px-2 py-1 rounded bg-[#C98A65] text-[#08080E] disabled:opacity-50"
              >
                salvar
              </button>
              <button
                onClick={() => {
                  setDraft(initial);
                  setEditing(false);
                }}
                className="text-xs px-2 py-1 rounded border border-white/10 text-[#F3EBDD]/70"
              >
                cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#C98A65] text-[#F3EBDD]/70"
              >
                editar
              </button>
              <button
                onClick={() => setContextModalOpen(true)}
                aria-label="Definir contexto inicial"
                className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#D9A441] text-[#F3EBDD]/70"
              >
                <BookOpen className="w-3 h-3 inline" />
              </button>
              <button
                onClick={() => setImporting((v) => !v)}
                aria-label="Importar contexto"
                className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#D9A441] text-[#F3EBDD]/70"
              >
                <UploadCloud className="w-3 h-3 inline" />
              </button>
              <button
                onClick={onRemove}
                aria-label="Remover perfil"
                className="text-xs px-2 py-1 rounded border border-white/10 hover:border-[#BE123C] text-[#BE123C]/70"
              >
                <Trash2 className="w-3 h-3 inline" />
              </button>
            </>
          )}
        </div>
      </div>
      {contextModalOpen && (
        <ContextInitialModal
          memberId={member.member_id}
          onClose={() => setContextModalOpen(false)}
        />
      )}
      {importing && <ImportPanel onImportContexto={onImportContexto} />}
    </li>
  );
}

// ─── ContextInitialModal ──────────────────────────────────────────

function ContextInitialModal({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const getCtxFn = useServerFn(getMemberInitialContext);
  const saveCtxFn = useServerFn(saveInitialContext);
  const [form, setForm] = useState({
    treatment_name: "",
    main_goal: "",
    tone: "",
    important_context: "",
    limits_and_cautions: "",
    response_preferences: "",
    admin_notes: "",
    initial_seeds: "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getCtxFn({ data: { memberId } }).then((ctx) => {
      if (ctx) {
        setForm({
          treatment_name: ctx.treatment_name ?? "",
          main_goal: ctx.main_goal ?? "",
          tone: ctx.tone ?? "",
          important_context: ctx.important_context ?? "",
          limits_and_cautions: ctx.limits_and_cautions ?? "",
          response_preferences: ctx.response_preferences ?? "",
          admin_notes: ctx.admin_notes ?? "",
          initial_seeds: ctx.initial_seeds ?? "",
        });
      }
    });
  }, [memberId, getCtxFn]);

  async function handleSave() {
    setBusy(true);
    try {
      await saveCtxFn({ data: { memberId, ...form } });
      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const fields: Array<{ key: keyof typeof form; label: string; multiline?: boolean }> = [
    { key: "treatment_name", label: "Nome de tratamento" },
    { key: "main_goal", label: "Objetivo principal", multiline: true },
    { key: "tone", label: "Tom de tratamento", multiline: true },
    { key: "important_context", label: "Contexto importante", multiline: true },
    { key: "limits_and_cautions", label: "Limites e cuidados", multiline: true },
    { key: "response_preferences", label: "Preferências de resposta", multiline: true },
    { key: "admin_notes", label: "Observações do admin", multiline: true },
    { key: "initial_seeds", label: "Sementes iniciais", multiline: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[80dvh] overflow-y-auto rounded-2xl border border-[#D9A441]/30 bg-[#111016] p-5 space-y-4">
        <h3 className="serif text-lg text-[#D9A441]">Contexto inicial</h3>
        <p className="text-[11px] text-[#F3EBDD]/60">
          Defina o contexto que será carregado no primeiro chat do usuário. Não é memória — é
          preparação do ambiente.
        </p>
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-[#F3EBDD]/50 mb-1">
              {f.label}
            </label>
            {f.multiline ? (
              <textarea
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                rows={2}
                className="w-full bg-[#0B0A10] border border-white/10 rounded-md p-2 text-xs outline-none focus:border-[#D9A441] resize-none"
              />
            ) : (
              <input
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-[#0B0A10] border border-white/10 rounded-md h-9 px-3 text-xs outline-none focus:border-[#D9A441]"
              />
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="h-9 px-4 rounded-md bg-[#D9A441] text-[#08080E] text-xs font-medium disabled:opacity-50"
          >
            {busy ? "Salvando…" : saved ? "Salvo ✓" : "Salvar contexto"}
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-white/10 text-xs text-[#F3EBDD]/70"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ImportPanel ──────────────────────────────────────────────────

function ImportPanel({
  onImportContexto,
}: {
  onImportContexto: (input: {
    titulo: string;
    conteudo: string;
    tipo: "identidade" | "memoria_relacional";
  }) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState<"identidade" | "memoria_relacional">("memoria_relacional");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#F3EBDD]/50">
        Importar contexto / identidade / memória já condensada
      </p>
      <p className="text-[11px] text-[#F3EBDD]/45">
        Cole o conteúdo já analisado (ex.: PDF condensado de outra Kháris). É assimilado como está,
        sem reinterpretação aqui.
      </p>
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título do bloco"
        className="w-full bg-[#0B0A10] border border-white/10 rounded-md h-9 px-3 text-xs outline-none focus:border-[#D9A441]"
      />
      <textarea
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        placeholder="Cole aqui o markdown de contexto/identidade/histórico já condensado…"
        rows={4}
        className="w-full bg-[#0B0A10] border border-white/10 rounded-md p-2 text-xs outline-none focus:border-[#D9A441]"
      />
      <div className="flex items-center gap-3">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "identidade" | "memoria_relacional")}
          className="bg-[#0B0A10] border border-white/10 rounded-md h-9 px-2 text-xs"
        >
          <option value="memoria_relacional">memória relacional (com esta pessoa)</option>
          <option value="identidade">identidade (continuidade da própria Kháris)</option>
        </select>
        <button
          disabled={busy || !titulo.trim() || !conteudo.trim()}
          onClick={async () => {
            setBusy(true);
            setOk(false);
            try {
              await onImportContexto({ titulo: titulo.trim(), conteudo: conteudo.trim(), tipo });
              setTitulo("");
              setConteudo("");
              setOk(true);
            } finally {
              setBusy(false);
            }
          }}
          className="h-9 px-3 rounded-md bg-[#D9A441] text-[#08080E] text-xs font-medium disabled:opacity-50"
        >
          {busy ? "importando…" : "importar contexto"}
        </button>
        {ok && <Check className="w-4 h-4 text-emerald-400" />}
      </div>
    </div>
  );
}

// ─── InviteRow ────────────────────────────────────────────────────

function InviteRow({ invite, onRevoke }: { invite: Invite; onRevoke: () => Promise<void> }) {
  const acceptUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/convite?token=${invite.token}`;
  const [copied, setCopied] = useState(false);
  const isPending = invite.status === "pending";

  return (
    <li className="rounded-xl border border-white/5 bg-[#111016] p-3 flex items-start gap-3">
      <Mail className="w-4 h-4 text-[#D9A441] mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-[#F3EBDD] truncate">{invite.email}</p>
          <span
            className={
              "text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded " +
              (isPending
                ? "bg-[#D9A441]/15 text-[#D9A441]"
                : invite.status === "accepted"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/5 text-[#F3EBDD]/45")
            }
          >
            {invite.status}
          </span>
        </div>
        <p className="text-[10px] text-[#F3EBDD]/45">
          {invite.modules.length} módulo(s) · expira em{" "}
          {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
        </p>
        {isPending && (
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={acceptUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-[#0B0A10] border border-white/10 rounded-md h-7 px-2 text-[10px] text-[#F3EBDD]/70 outline-none"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(acceptUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="h-7 px-2 rounded border border-white/10 hover:border-[#C98A65] text-[10px] text-[#F3EBDD]/70 inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> {copied ? "copiado" : "copiar link"}
            </button>
          </div>
        )}
      </div>
      {isPending && (
        <button
          onClick={onRevoke}
          aria-label="Revogar convite"
          className="text-[#F3EBDD]/40 hover:text-[#BE123C]"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}
