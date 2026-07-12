import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarDays, MessageCircle, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getKuanPlanWorkspace,
  upsertKuanBusinessPlan,
  transitionKuanPlanDecision,
  createKuanPlanMilestone,
  upsertKuanPlanReviewCycle,
  startKuanPlanReview,
} from "@/lib/kuan-plan.functions";
import type { PlanDecisionStatus } from "@/lib/kuan-plan.transitions";
import { PlanDecisionCard } from "./PlanDecisionCard";
import { ConfirmTransitionDialog } from "./PlanDialogs";

export function KuanPlanPage() {
  const navigate = useNavigate();
  const load = useServerFn(getKuanPlanWorkspace);
  const upsertPlan = useServerFn(upsertKuanBusinessPlan);
  const transitionDecision = useServerFn(transitionKuanPlanDecision);
  const createMilestone = useServerFn(createKuanPlanMilestone);
  const upsertCycle = useServerFn(upsertKuanPlanReviewCycle);
  const startReview = useServerFn(startKuanPlanReview);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [coachText, setCoachText] = useState("");
  const [pending, setPending] = useState<{ decision: any; next: PlanDecisionStatus } | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setWorkspace(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o plano.");
    } finally {
      setLoading(false);
    }
  }
  useMemo(() => {
    void refresh();
  }, []);

  async function createBasicPlan() {
    try {
      await upsertPlan({ data: { objectives: [], strengths: [], challenges: [] } });
      toast.success("Plano básico criado.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar plano.");
    }
  }
  async function confirmTransition() {
    if (!pending) return;
    try {
      await transitionDecision({
        data: {
          id: pending.decision.id,
          expectedStatus: pending.decision.status,
          nextStatus: pending.next,
        },
      });
      toast.success("Decisão atualizada.");
      setPending(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar decisão.");
    }
  }
  async function makeMilestone(decision: any) {
    try {
      await createMilestone({
        data: {
          decision_id: decision.id,
          title: decision.title,
          description: decision.decision_text,
        },
      });
      toast.success("Marco criado como planejado.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar marco.");
    }
  }
  function openCoach(seed: string) {
    navigate({ to: "/kuan", search: { seed } as never });
  }

  if (loading) return <Centered text="Organizando o plano do negócio..." />;
  if (error)
    return (
      <Centered
        text={
          error.includes("Guardião") || error.includes("Configure")
            ? error
            : "Não foi possível carregar o plano."
        }
        action={<Button onClick={refresh}>Tentar novamente</Button>}
        extra={
          error.includes("Configure") ? (
            <Button asChild variant="outline">
              <Link to="/kuan/config">Configurar negócio</Link>
            </Button>
          ) : null
        }
      />
    );
  if (!workspace?.plan)
    return (
      <Centered
        text="Seu negócio ainda não possui um plano estratégico estruturado."
        action={
          <Button
            onClick={() =>
              openCoach("Quero criar um plano estratégico para meu negócio com a Kuan.")
            }
          >
            Criar plano com Kuan
          </Button>
        }
        extra={
          <Button variant="outline" onClick={createBasicPlan}>
            Criar plano básico
          </Button>
        }
      />
    );

  const { businessContext, plan, decisions, milestones, reviewCycles, reviews, linkedClients } =
    workspace;
  const filtered = filter === "all" ? decisions : decisions.filter((d: any) => d.status === filter);
  const proposedCount = decisions.filter((d: any) => d.status === "proposed").length;
  const nextReview = reviewCycles
    .map((c: any) => c.next_review_at)
    .filter(Boolean)
    .sort()[0];

  return (
    <main className="min-h-screen bg-[#08070d] px-4 py-6 text-[color:var(--ivory)] sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <header className="border-b border-pink-500/20 pb-4">
            <div className="text-xs font-bold text-pink-300">✦ Kuan</div>
            <h1 className="serif text-4xl font-bold">Plano de Negócio</h1>
            <p className="text-sm text-[color:var(--ivory-dim)]">
              Estratégia, decisões, execução e revisão em uma central privada do Guardião.
            </p>
          </header>
          <section className="rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-950/45 to-black p-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-pink-300">
              Direção atual
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_240px]">
              <div>
                <h2 className="serif text-3xl font-semibold italic">
                  {plan.current_direction || "Direção ainda não definida."}
                </h2>
                <p className="mt-3 text-sm text-[color:var(--ivory-dim)]">
                  Status: {plan.status}. {proposedCount} propostas aguardam decisão.
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <Info
                  label="Próxima revisão"
                  value={
                    nextReview ? new Date(nextReview).toLocaleDateString("pt-BR") : "Não definida"
                  }
                />
                <Info
                  label="Objetivos"
                  value={Array.isArray(plan.objectives) ? String(plan.objectives.length) : "0"}
                />
              </div>
            </div>
          </section>
          <section>
            <h2 className="serif text-2xl font-bold italic">Visão do negócio</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Card title="Contexto comercial" source="business_contexts">
                <p>{businessContext.nome || "Negócio sem nome"}</p>
                <p>{businessContext.tipo || "Tipo não informado"}</p>
              </Card>
              <Card title="Plano" source="kuanyin_business_plans">
                <p>
                  <b>Missão:</b> {plan.mission || "Não definida"}
                </p>
                <p>
                  <b>Visão:</b> {plan.vision || "Não definida"}
                </p>
              </Card>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                onClick={() => openCoach("Revise a direção do meu plano e proponha ajustes.")}
              >
                Revisar com Kuan
              </Button>
            </div>
          </section>
          <section>
            <h2 className="serif text-2xl font-bold italic">Decisões</h2>
            <Tabs value={filter} onValueChange={setFilter} className="mt-3">
              <TabsList className="flex h-auto flex-wrap justify-start bg-transparent p-0">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="proposed">Propostas</TabsTrigger>
                <TabsTrigger value="accepted">Aceitas</TabsTrigger>
                <TabsTrigger value="in_review">Em revisão</TabsTrigger>
                <TabsTrigger value="superseded">Substituídas</TabsTrigger>
                <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
                <TabsTrigger value="archived">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-4 space-y-3">
              {filtered.length ? (
                filtered.map((d: any) => (
                  <PlanDecisionCard
                    key={d.id}
                    decision={d}
                    onTransition={(decision, next) => setPending({ decision, next })}
                    onMilestone={makeMilestone}
                  />
                ))
              ) : (
                <Empty text="Nenhuma decisão real neste filtro." />
              )}
            </div>
          </section>
          <section>
            <h2 className="serif text-2xl font-bold italic">Cronograma do plano</h2>
            <div className="mt-3 rounded-2xl border border-pink-500/20 bg-pink-950/10 p-4">
              {milestones.length ? (
                milestones.map((m: any) => (
                  <div key={m.id} className="relative border-l border-pink-400/50 pb-4 pl-4">
                    <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-pink-400" />
                    <b>{m.title}</b>
                    <p className="text-xs text-[color:var(--ivory-dim)]">
                      {m.status}
                      {m.due_at ? ` · ${new Date(m.due_at).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <Empty text="Nenhum marco planejado." />
              )}
              <Button
                className="mt-3"
                onClick={() => openCoach("Proponha um marco para meu plano estratégico.")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar marco com Kuan
              </Button>
            </div>
          </section>
          <section>
            <h2 className="serif text-2xl font-bold italic">Clientes relacionados</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {linkedClients.length ? (
                linkedClients.map((c: any) => (
                  <Card key={c.id} title={c.nome} source="kuanyin_plan_links">
                    <p>Status: {c.status || "não informado"}</p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/kuan/clientes">Ver cliente</Link>
                    </Button>
                  </Card>
                ))
              ) : (
                <Empty text="Nenhum cliente vinculado ao plano." />
              )}
            </div>
          </section>
          <section>
            <h2 className="serif text-2xl font-bold italic">Ciclos de revisão</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {["weekly", "monthly", "quarterly"].map((cadence) => {
                const cycle = reviewCycles.find((c: any) => c.cadence === cadence);
                return (
                  <Card
                    key={cadence}
                    title={
                      { weekly: "Semanal", monthly: "Mensal", quarterly: "Trimestral" }[cadence]!
                    }
                    source="kuanyin_plan_review_cycles"
                  >
                    <p>{cycle?.is_active ? "Ativo" : "Não configurado"}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await upsertCycle({
                          data: {
                            cadence: cadence as any,
                            label: cadence,
                            is_active: true,
                            checklist: [],
                          },
                        });
                        await refresh();
                      }}
                    >
                      Ativar/atualizar
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await startReview({
                          data: { title: `Revisão ${cadence}`, cycle_id: cycle?.id ?? null },
                        });
                        await refresh();
                      }}
                    >
                      Iniciar revisão
                    </Button>
                  </Card>
                );
              })}
            </div>
            {reviews.length ? (
              <div className="mt-3 text-sm text-[color:var(--ivory-dim)]">
                Revisões recentes: {reviews.map((r: any) => r.title).join(" · ")}
              </div>
            ) : null}
          </section>
        </section>
        <aside className="h-fit rounded-3xl border border-pink-400/20 bg-pink-950/20 p-4 lg:sticky lg:top-6">
          <h2 className="serif text-xl font-bold italic">Converse com Kuan sobre este plano</h2>
          <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
            Atalhos abrem o chat principal com contexto real aprovado.
          </p>
          <div className="mt-3 space-y-2">
            {[
              "O que preciso revisar esta semana no meu plano?",
              "Quais propostas aguardam minha decisão?",
              "Resuma meu plano atual e separe fatos, inferências e propostas.",
            ].map((s) => (
              <Button
                key={s}
                className="w-full justify-start"
                variant="outline"
                onClick={() => openCoach(s)}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {s}
              </Button>
            ))}
          </div>
          <Textarea
            className="mt-3"
            placeholder="Pergunte sobre o negócio, decisões, clientes, cronograma ou revisões..."
            value={coachText}
            onChange={(e) => setCoachText(e.target.value)}
          />
          <Button
            className="mt-3"
            onClick={() => openCoach(coachText || "Vamos revisar meu plano.")}
          >
            Enviar para Kuan <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </aside>
      </div>
      <ConfirmTransitionDialog
        open={Boolean(pending)}
        onOpenChange={(v) => !v && setPending(null)}
        transition={
          pending
            ? { title: pending.decision.title, from: pending.decision.status, to: pending.next }
            : null
        }
        onConfirm={confirmTransition}
      />
    </main>
  );
}
function Centered({
  text,
  action,
  extra,
}: {
  text: string;
  action?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#08070d] p-6 text-center text-[color:var(--ivory)]">
      <p>{text}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {action}
        {extra}
      </div>
    </div>
  );
}
function Card({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-pink-500/20 bg-white/[0.03] p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-pink-300">{source}</div>
      <h3 className="mt-1 font-semibold">{title}</h3>
      <div className="mt-2 space-y-2 text-sm text-[color:var(--ivory-dim)]">{children}</div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-pink-400/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--ivory-dim)]">
        {label}
      </div>
      <b>{value}</b>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-pink-500/20 p-4 text-sm text-[color:var(--ivory-dim)]">
      {text}
    </div>
  );
}
