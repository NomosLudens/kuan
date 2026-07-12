export type KuanPlanContextInput = {
  plan?: { current_direction?: string | null; objectives?: unknown } | null;
  decisions?: Array<{
    id: string;
    title: string;
    status: string;
    decision_text?: string | null;
    priority?: string | null;
  }>;
  milestones?: Array<{ id: string; title: string; status: string; due_at?: string | null }>;
  reviews?: Array<{
    id: string;
    title: string;
    status: string;
    scheduled_at?: string | null;
    summary?: string | null;
  }>;
  linkedClients?: Array<{ id: string; nome: string; plan_id?: string | null }>;
  planId?: string | null;
};

const MAX_BLOCK = 16_000;

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function renderKuanPlanContextBlock(input: KuanPlanContextInput): string {
  if (!input.plan) return "";
  const accepted = (input.decisions ?? []).filter((d) => d.status === "accepted").slice(0, 12);
  const pending = (input.decisions ?? [])
    .filter((d) => d.status === "proposed" || d.status === "in_review")
    .slice(0, 8);
  const milestones = (input.milestones ?? [])
    .filter((m) => m.status !== "completed" && m.status !== "cancelled")
    .slice(0, 12);
  const reviews = (input.reviews ?? []).filter((r) => r.status !== "cancelled").slice(0, 6);
  const clients = (input.linkedClients ?? [])
    .filter((c) => !input.planId || !c.plan_id || c.plan_id === input.planId)
    .slice(0, 10);

  const lines = [
    "\n=== CONTEXTO DO PLANO COMERCIAL KUAN ===",
    "Semântica: accepted = decisão confirmada pelo Guardião; proposed = pendência, nunca regra; in_review = sob revisão; superseded/archived/rejected = histórico, não orientação ativa.",
    "Conversas do Guardião podem gerar propostas de plano, decisão ou marco. Nada entra como decisão confirmada sem ação explícita do Guardião.",
    "Separe FATO, INFERÊNCIA, PROPOSTA e DECISÃO CONFIRMADA.",
    input.plan.current_direction
      ? `Direção atual: ${input.plan.current_direction}`
      : "Direção atual: não definida.",
  ];
  const objectives = arrayOfStrings(input.plan.objectives);
  if (objectives.length) lines.push(`Objetivos: ${objectives.join("; ")}`);
  if (accepted.length) {
    lines.push("DECISÕES CONFIRMADAS:");
    accepted.forEach((d) =>
      lines.push(`- ${d.title}: ${d.decision_text ?? "sem texto"} (${d.priority ?? "medium"})`),
    );
  }
  if (pending.length) {
    lines.push("PROPOSTAS/PENDÊNCIAS:");
    pending.forEach((d) =>
      lines.push(`- [${d.status}] ${d.title}: ${d.decision_text ?? "sem texto"}`),
    );
  }
  if (milestones.length) {
    lines.push("MARCOS PRÓXIMOS/ABERTOS:");
    milestones.forEach((m) =>
      lines.push(`- [${m.status}] ${m.title}${m.due_at ? ` até ${m.due_at}` : ""}`),
    );
  }
  if (reviews.length) {
    lines.push("REVISÕES RECENTES/PENDENTES:");
    reviews.forEach((r) =>
      lines.push(`- [${r.status}] ${r.title}${r.summary ? `: ${r.summary}` : ""}`),
    );
  }
  if (clients.length) lines.push(`Clientes vinculados: ${clients.map((c) => c.nome).join("; ")}`);
  lines.push("=== FIM DO CONTEXTO DO PLANO ===");
  const block = lines.join("\n");
  return block.length > MAX_BLOCK
    ? block.slice(0, MAX_BLOCK - 32) + "\n[contexto truncado]"
    : block;
}

export async function loadKuanPlanContext(args: {
  supabase: any;
  guardianId: string;
  businessContextId: string;
}) {
  const { supabase, guardianId, businessContextId } = args;
  const { data: plan } = await supabase
    .from("kuanyin_business_plans")
    .select("id,current_direction,objectives")
    .eq("guardian_id", guardianId)
    .eq("business_context_id", businessContextId)
    .maybeSingle();
  if (!plan) return "";
  const [{ data: decisions }, { data: milestones }, { data: reviews }, { data: links }] =
    await Promise.all([
      (supabase as any)
        .from("kuanyin_plan_decisions")
        .select("id,title,status,decision_text,priority")
        .eq("plan_id", plan.id)
        .in("status", ["accepted", "proposed", "in_review"]),
      (supabase as any)
        .from("kuanyin_plan_milestones")
        .select("id,title,status,due_at")
        .eq("plan_id", plan.id)
        .order("due_at", { ascending: true }),
      (supabase as any)
        .from("kuanyin_plan_reviews")
        .select("id,title,status,scheduled_at,summary")
        .eq("plan_id", plan.id)
        .order("created_at", { ascending: false })
        .limit(6),
      (supabase as any)
        .from("kuanyin_plan_links")
        .select("entity_id")
        .eq("plan_id", plan.id)
        .eq("entity_type", "client")
        .limit(10),
    ]);
  let linkedClients: Array<{ id: string; nome: string; plan_id: string }> = [];
  const ids = Array.from(new Set((links ?? []).map((l: any) => l.entity_id).filter(Boolean)));
  if (ids.length) {
    const { data: clients } = await (supabase as any)
      .from("kuanyin_clients")
      .select("id,nome")
      .in("id", ids);
    linkedClients = (clients ?? []).map((c: any) => ({ ...c, plan_id: plan.id }));
  }
  return renderKuanPlanContextBlock({
    plan,
    decisions,
    milestones,
    reviews,
    linkedClients,
    planId: plan.id,
  });
}
