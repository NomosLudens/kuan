import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "PR33_USER_A_EMAIL",
  "PR33_USER_A_PASSWORD",
  "PR33_USER_B_EMAIL",
  "PR33_USER_B_PASSWORD",
  "PR33_PLAN_A_ID",
  "PR33_PLAN_B_ID",
  "PR33_DECISION_A_ID",
] as const;

function env(name: (typeof requiredEnv)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function assertBlocked(
  label: string,
  result: { data: unknown; error: { message?: string } | null },
) {
  const emptyArray = Array.isArray(result.data) && result.data.length === 0;
  const noSingleRow = result.data === null;
  if (result.error || emptyArray || noSingleRow) {
    console.log(`PASS ${label}: ${result.error?.message ?? "zero rows"}`);
    return;
  }
  throw new Error(`FAIL ${label}: cross-guardian operation returned data`);
}

function assertNoRows(label: string, rows: unknown[] | null) {
  if (Array.isArray(rows) && rows.length === 0) {
    console.log(`PASS ${label}: zero rows`);
    return;
  }
  throw new Error(`FAIL ${label}: expected zero rows`);
}

async function signedClient(email: string, password: string) {
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"));
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Cannot sign in ${email}: ${error.message}`);
  return client;
}

const userA = await signedClient(env("PR33_USER_A_EMAIL"), env("PR33_USER_A_PASSWORD"));
const userB = await signedClient(env("PR33_USER_B_EMAIL"), env("PR33_USER_B_PASSWORD"));
const planAId = env("PR33_PLAN_A_ID");
const planBId = env("PR33_PLAN_B_ID");
const decisionAId = env("PR33_DECISION_A_ID");

const { data: beforeDecisionA, error: beforeDecisionError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id,status,superseded_by,plan_id")
  .eq("id", decisionAId)
  .single();
if (beforeDecisionError) throw beforeDecisionError;

const { count: beforeDecisionCount, error: beforeCountError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id", { count: "exact", head: true })
  .eq("plan_id", planAId);
if (beforeCountError) throw beforeCountError;

assertBlocked(
  "B cannot select plan A",
  await userB.from("kuanyin_business_plans").select("id").eq("id", planAId),
);
assertBlocked(
  "B cannot select decision A",
  await userB.from("kuanyin_plan_decisions").select("id,status").eq("id", decisionAId),
);

const rpcResult = await userB.rpc("kuanyin_supersede_plan_decision", {
  p_old_decision_id: decisionAId,
  p_title: "Tentativa bloqueada",
  p_decision_type: "strategy",
  p_decision_text: "Não deve persistir",
  p_context: null,
  p_rationale: null,
  p_consequences: [],
  p_priority: "medium",
  p_review_at: null,
  p_accept_now: false,
});
assertBlocked("B cannot supersede decision A", rpcResult);

assertBlocked(
  "B cannot create milestone in plan A pointing to decision A",
  await userB
    .from("kuanyin_plan_milestones")
    .insert({ plan_id: planAId, decision_id: decisionAId, title: "Tentativa bloqueada" })
    .select("id"),
);

assertBlocked(
  "B cannot link entity to plan A",
  await userB
    .from("kuanyin_plan_links")
    .insert({ plan_id: planAId, entity_type: "client", entity_id: planBId })
    .select("id"),
);

const { data: afterDecisionA, error: afterDecisionError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id,status,superseded_by,plan_id")
  .eq("id", decisionAId)
  .single();
if (afterDecisionError) throw afterDecisionError;

const { count: afterDecisionCount, error: afterCountError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id", { count: "exact", head: true })
  .eq("plan_id", planAId);
if (afterCountError) throw afterCountError;

if (JSON.stringify(beforeDecisionA) !== JSON.stringify(afterDecisionA)) {
  throw new Error("FAIL decision A changed during B isolation attempts");
}
if (beforeDecisionCount !== afterDecisionCount) {
  throw new Error("FAIL plan A decision count changed during B isolation attempts");
}

const { data: leakedMilestones, error: milestoneCheckError } = await userA
  .from("kuanyin_plan_milestones")
  .select("id")
  .eq("plan_id", planAId)
  .eq("title", "Tentativa bloqueada");
if (milestoneCheckError) throw milestoneCheckError;
assertNoRows("No blocked milestone persisted in plan A", leakedMilestones);

console.log("PR33 real isolation QA passed with authenticated user sessions only.");
