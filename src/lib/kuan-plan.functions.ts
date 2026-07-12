import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeKuanIntegrityLog } from "@/lib/kuanyin-integrity";
import {
  assertMilestoneDates,
  canTransitionDecision,
  canTransitionMilestone,
} from "@/lib/kuan-plan.transitions";

function db(supabase: unknown): any {
  return supabase as any;
}

const stringArray = z.array(z.string().trim().min(1).max(500)).max(30).default([]);
const decisionType = z.enum([
  "strategy",
  "pricing",
  "service",
  "client_policy",
  "schedule",
  "communication",
  "operations",
  "marketing",
  "finance",
  "risk",
  "other",
]);
const decisionPriority = z.enum(["low", "medium", "high", "critical"]);
const decisionStatus = z.enum([
  "proposed",
  "accepted",
  "in_review",
  "superseded",
  "rejected",
  "archived",
]);
const milestoneStatus = z.enum([
  "planned",
  "in_progress",
  "completed",
  "delayed",
  "blocked",
  "cancelled",
]);

async function resolvePlanOwner(supabase: any, userId: string) {
  const { data: guardian, error: gError } = await supabase
    .from("kuanyin_guardians")
    .select("id,user_id,business_context_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (gError) throw new Error(gError.message);
  if (!guardian) throw new Error("Nenhum Guardião operacional está vinculado a esta conta.");
  const businessContextId = guardian.business_context_id;
  if (!businessContextId) throw new Error("Configure o negócio antes de criar o plano.");
  return {
    guardianId: guardian.id as string,
    businessContextId: businessContextId as string,
    userId,
  };
}

async function getOrCreatePlan(supabase: any, owner: Awaited<ReturnType<typeof resolvePlanOwner>>) {
  const { data, error } = await supabase
    .from("kuanyin_business_plans")
    .upsert(
      {
        guardian_id: owner.guardianId,
        business_context_id: owner.businessContextId,
        created_by: owner.userId,
        updated_by: owner.userId,
      },
      { onConflict: "guardian_id,business_context_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function log(
  supabase: any,
  userId: string,
  category: string,
  note: string,
  excerpt?: string,
) {
  await writeKuanIntegrityLog({
    supabase,
    userId,
    category,
    note,
    excerpt: excerpt?.slice(0, 240) ?? null,
  });
}

export const getKuanPlanWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const { data: businessContext, error: bcError } = await db(context.supabase)
      .from("business_contexts")
      .select("id,nome,tipo,servicos,precos,formas_pagamento,regras_agenda,limites_decisao")
      .eq("id", owner.businessContextId)
      .maybeSingle();
    if (bcError) throw new Error(bcError.message);
    if (!businessContext) throw new Error("Configure o negócio antes de criar o plano.");
    const { data: plan, error: pError } = await db(context.supabase)
      .from("kuanyin_business_plans")
      .select("*")
      .eq("guardian_id", owner.guardianId)
      .eq("business_context_id", owner.businessContextId)
      .maybeSingle();
    if (pError) throw new Error(pError.message);
    if (!plan)
      return {
        businessContext,
        plan: null,
        decisions: [],
        milestones: [],
        reviewCycles: [],
        reviews: [],
        linkedClients: [],
      };
    const [decisionsResult, milestonesResult, reviewCyclesResult, reviewsResult, linksResult] =
      await Promise.all([
        db(context.supabase)
          .from("kuanyin_plan_decisions")
          .select("*")
          .eq("plan_id", plan.id)
          .order("created_at", { ascending: false }),
        db(context.supabase)
          .from("kuanyin_plan_milestones")
          .select("*")
          .eq("plan_id", plan.id)
          .order("due_at", { ascending: true }),
        db(context.supabase)
          .from("kuanyin_plan_review_cycles")
          .select("*")
          .eq("plan_id", plan.id)
          .order("cadence"),
        db(context.supabase)
          .from("kuanyin_plan_reviews")
          .select("*")
          .eq("plan_id", plan.id)
          .order("created_at", { ascending: false })
          .limit(10),
        db(context.supabase).from("kuanyin_plan_links").select("*").eq("plan_id", plan.id),
      ]);
    for (const result of [
      decisionsResult,
      milestonesResult,
      reviewCyclesResult,
      reviewsResult,
      linksResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }
    const decisions = decisionsResult.data ?? [];
    const milestones = milestonesResult.data ?? [];
    const reviewCycles = reviewCyclesResult.data ?? [];
    const reviews = reviewsResult.data ?? [];
    const links = linksResult.data ?? [];
    const clientIds = Array.from(
      new Set(
        (links ?? []).filter((l: any) => l.entity_type === "client").map((l: any) => l.entity_id),
      ),
    );
    let linkedClients: any[] = [];
    if (clientIds.length) {
      const { data, error } = await db(context.supabase)
        .from("kuanyin_clients")
        .select("id,nome,status,telefone,email,notas")
        .in("id", clientIds);
      if (error) throw new Error(error.message);
      linkedClients = (data ?? []).map((client: any) => ({
        ...client,
        link: (links ?? []).find((l: any) => l.entity_id === client.id),
      }));
    }
    return {
      businessContext,
      plan,
      decisions,
      milestones,
      reviewCycles,
      reviews,
      linkedClients,
    };
  });

export const upsertKuanBusinessPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      current_direction: z.string().trim().max(4000).optional().nullable(),
      mission: z.string().trim().max(4000).optional().nullable(),
      vision: z.string().trim().max(4000).optional().nullable(),
      objectives: stringArray.optional(),
      strengths: stringArray.optional(),
      challenges: stringArray.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const patch = {
      ...data,
      guardian_id: owner.guardianId,
      business_context_id: owner.businessContextId,
      updated_by: owner.userId,
    };
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_business_plans")
      .upsert(patch, { onConflict: "guardian_id,business_context_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await log(
      db(context.supabase),
      owner.userId,
      planId === row.id ? "plan_updated" : "plan_created",
      "Plano estratégico salvo.",
    );
    return row;
  });

const decisionInput = z.object({
  title: z.string().trim().min(1).max(200),
  decision_type: decisionType.default("other"),
  context: z.string().trim().max(4000).optional().nullable(),
  decision: z.string().trim().min(1).max(4000),
  rationale: z.string().trim().max(4000).optional().nullable(),
  consequences: stringArray.optional(),
  priority: decisionPriority.default("medium"),
  review_at: z.string().datetime({ offset: true }).optional().nullable(),
});
export const proposeKuanPlanDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(decisionInput)
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_decisions")
      .insert({
        plan_id: planId,
        title: data.title,
        decision_type: data.decision_type,
        context: data.context,
        decision_text: data.decision,
        rationale: data.rationale,
        consequences: data.consequences ?? [],
        priority: data.priority,
        review_at: data.review_at ?? null,
        status: "proposed",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await log(
      db(context.supabase),
      owner.userId,
      "plan_decision_proposed",
      "Proposta de decisão registrada.",
      data.title,
    );
    return row;
  });

export const transitionKuanPlanDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({ id: z.string().uuid(), expectedStatus: decisionStatus, nextStatus: decisionStatus }),
  )
  .handler(async ({ data, context }) => {
    if (!canTransitionDecision(data.expectedStatus, data.nextStatus))
      throw new Error("Transição de decisão inválida.");
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const patch: any = { status: data.nextStatus };
    if (data.nextStatus === "accepted") {
      patch.accepted_by = owner.userId;
      patch.accepted_at = new Date().toISOString();
    }
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_decisions")
      .update(patch)
      .eq("id", data.id)
      .eq("plan_id", planId)
      .eq("status", data.expectedStatus)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("A decisão mudou de estado. Recarregue e tente novamente.");
    await log(
      db(context.supabase),
      owner.userId,
      `plan_decision_${data.nextStatus === "in_review" ? "review_started" : data.nextStatus}`,
      "Estado da decisão alterado.",
    );
    return row;
  });

export const supersedeKuanPlanDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      oldDecisionId: z.string().uuid(),
      newDecision: decisionInput,
      acceptNow: z.boolean().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    await getOrCreatePlan(db(context.supabase), owner);
    const { data: created, error } = await db(context.supabase).rpc(
      "kuanyin_supersede_plan_decision",
      {
        p_old_decision_id: data.oldDecisionId,
        p_title: data.newDecision.title,
        p_decision_type: data.newDecision.decision_type,
        p_context: data.newDecision.context,
        p_decision_text: data.newDecision.decision,
        p_rationale: data.newDecision.rationale,
        p_consequences: data.newDecision.consequences ?? [],
        p_priority: data.newDecision.priority,
        p_review_at: data.newDecision.review_at ?? null,
        p_accept_now: data.acceptNow,
      },
    );
    if (error) throw new Error(error.message);
    await log(
      db(context.supabase),
      owner.userId,
      "plan_decision_superseded",
      "Decisão substituída.",
    );
    return created;
  });

export const createKuanPlanMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      decision_id: z.string().uuid().optional().nullable(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(4000).optional().nullable(),
      starts_at: z.string().datetime({ offset: true }).optional().nullable(),
      due_at: z.string().datetime({ offset: true }).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    assertMilestoneDates(data.starts_at, data.due_at);
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    if (data.decision_id) {
      const { data: decision, error: decisionError } = await db(context.supabase)
        .from("kuanyin_plan_decisions")
        .select("id")
        .eq("id", data.decision_id)
        .eq("plan_id", planId)
        .maybeSingle();
      if (decisionError || !decision) {
        throw new Error("A decisão informada não pertence a este plano.");
      }
    }
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_milestones")
      .insert({
        plan_id: planId,
        decision_id: data.decision_id,
        title: data.title,
        description: data.description,
        starts_at: data.starts_at,
        due_at: data.due_at,
        status: "planned",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await log(
      db(context.supabase),
      owner.userId,
      "plan_milestone_created",
      "Marco criado.",
      data.title,
    );
    return row;
  });

export const transitionKuanPlanMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      expectedStatus: milestoneStatus,
      nextStatus: milestoneStatus,
    }),
  )
  .handler(async ({ data, context }) => {
    if (!canTransitionMilestone(data.expectedStatus, data.nextStatus))
      throw new Error("Transição de marco inválida.");
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const patch: any = { status: data.nextStatus };
    if (data.nextStatus === "completed") patch.completed_at = new Date().toISOString();
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_milestones")
      .update(patch)
      .eq("id", data.id)
      .eq("plan_id", planId)
      .eq("status", data.expectedStatus)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("O marco mudou de estado. Recarregue e tente novamente.");
    await log(db(context.supabase), owner.userId, "plan_milestone_updated", "Marco atualizado.");
    return row;
  });

export const upsertKuanPlanReviewCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cadence: z.enum(["weekly", "monthly", "quarterly"]),
      label: z.string().min(1),
      is_active: z.boolean().default(true),
      next_review_at: z.string().datetime({ offset: true }).optional().nullable(),
      checklist: stringArray.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_review_cycles")
      .upsert(
        { plan_id: planId, ...data, checklist: data.checklist ?? [] },
        { onConflict: "plan_id,cadence" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
export const startKuanPlanReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycle_id: z.string().uuid().optional().nullable(),
      title: z.string().min(1),
      scheduled_at: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const workspace = await db(context.supabase)
      .from("kuanyin_plan_decisions")
      .select("id,title,status,review_at")
      .eq("plan_id", planId)
      .in("status", ["proposed", "in_review", "accepted"]);
    const facts = (workspace.data ?? []).map((d: any) => ({
      type: "decision",
      id: d.id,
      title: d.title,
      status: d.status,
      review_at: d.review_at,
    }));
    if (data.cycle_id) {
      const { data: cycle, error: cycleError } = await db(context.supabase)
        .from("kuanyin_plan_review_cycles")
        .select("id")
        .eq("id", data.cycle_id)
        .eq("plan_id", planId)
        .maybeSingle();
      if (cycleError || !cycle) throw new Error("O ciclo informado não pertence a este plano.");
    }
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_reviews")
      .insert({
        plan_id: planId,
        cycle_id: data.cycle_id,
        title: data.title,
        scheduled_at: data.scheduled_at,
        started_at: new Date().toISOString(),
        status: "in_progress",
        facts,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await log(db(context.supabase), owner.userId, "plan_review_started", "Revisão iniciada.");
    return row;
  });
export const completeKuanPlanReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      summary: z.string().trim().min(1).max(4000),
      inferences: stringArray.optional(),
      proposals: stringArray.optional(),
      next_actions: stringArray.optional(),
      decisions_reviewed: z.array(z.string().uuid()).default([]),
      next_review_at: z.string().datetime({ offset: true }).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_reviews")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: data.summary,
        inferences: data.inferences ?? [],
        proposals: data.proposals ?? [],
        next_actions: data.next_actions ?? [],
        decisions_reviewed: data.decisions_reviewed,
      })
      .eq("id", data.id)
      .eq("plan_id", planId)
      .eq("status", "in_progress")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (row.cycle_id) {
      const { error: cycleError } = await db(context.supabase)
        .from("kuanyin_plan_review_cycles")
        .update({
          last_review_at: new Date().toISOString(),
          next_review_at: data.next_review_at ?? null,
        })
        .eq("id", row.cycle_id)
        .eq("plan_id", planId);
      if (cycleError) throw new Error(cycleError.message);
    }
    await log(db(context.supabase), owner.userId, "plan_review_completed", "Revisão concluída.");
    return row;
  });
export const linkKuanPlanEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      entity_type: z.literal("client"),
      entity_id: z.string().uuid(),
      relation_type: z.string().default("related"),
      notes: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const { data: client } = await db(context.supabase)
      .from("kuanyin_clients")
      .select("id,business_context_id,user_id")
      .eq("id", data.entity_id)
      .eq("user_id", owner.userId)
      .maybeSingle();
    if (
      !client ||
      (client.business_context_id && client.business_context_id !== owner.businessContextId)
    )
      throw new Error("Cliente não pertence a este contexto de negócio.");
    const { data: row, error } = await db(context.supabase)
      .from("kuanyin_plan_links")
      .upsert(
        {
          plan_id: planId,
          entity_type: "client",
          entity_id: data.entity_id,
          relation_type: data.relation_type,
          notes: data.notes,
        },
        { onConflict: "plan_id,entity_type,entity_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await log(
      db(context.supabase),
      owner.userId,
      "plan_entity_linked",
      "Entidade vinculada ao plano.",
    );
    return row;
  });
export const unlinkKuanPlanEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ link_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const owner = await resolvePlanOwner(db(context.supabase), context.userId);
    const planId = await getOrCreatePlan(db(context.supabase), owner);
    const { data: removed, error } = await db(context.supabase)
      .from("kuanyin_plan_links")
      .delete()
      .eq("id", data.link_id)
      .eq("plan_id", planId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!removed) throw new Error("Vínculo não encontrado neste plano.");
    await log(
      db(context.supabase),
      owner.userId,
      "plan_entity_unlinked",
      "Vínculo removido do plano.",
    );
    return { ok: true };
  });
