import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!anonKey) throw new Error("Missing SUPABASE_ANON_KEY");

const email = process.env.PR36_USER_A_EMAIL;
const password = process.env.PR36_USER_A_PASSWORD;
const decisionId = process.env.PR36_DECISION_A_ID;
const planId = process.env.PR36_PLAN_A_ID;
if (!email || !password || !decisionId || !planId) throw new Error("Missing PR36 fixture env");

function rpcPayload(title: string) {
  return {
    p_old_decision_id: decisionId,
    p_title: title,
    p_decision_type: "strategy",
    p_context: "  contexto normalizado  ",
    p_decision_text: "  texto normalizado  ",
    p_rationale: "  racional normalizado  ",
    p_consequences: ["  consequência normalizada  "],
    p_priority: "medium",
    p_review_at: null,
    p_accept_now: true,
  };
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const anonResult = await anon.rpc("kuanyin_supersede_plan_decision", rpcPayload("Anon bloqueado"));
if (!anonResult.error) throw new Error("FAIL anon executed kuanyin_supersede_plan_decision");
console.log(`PASS anon cannot execute RPC: ${anonResult.error.message}`);

const userA = createClient(url, anonKey, { auth: { persistSession: false } });
const { error: signInError } = await userA.auth.signInWithPassword({ email, password });
if (signInError) throw signInError;

const before = await userA
  .from("kuanyin_plan_decisions")
  .select("id", { count: "exact", head: true })
  .eq("plan_id", planId);
if (before.error) throw before.error;

const [first, second] = await Promise.allSettled([
  userA.rpc("kuanyin_supersede_plan_decision", rpcPayload("   Título normalizado   ")),
  userA.rpc("kuanyin_supersede_plan_decision", rpcPayload("   Título normalizado   ")),
]);

const results = [first, second].map((settled) => {
  if (settled.status === "rejected") return { data: null, error: settled.reason as Error };
  return settled.value;
});
const winners = results.filter((result) => result.data && !result.error);
const failures = results.filter((result) => result.error);
if (winners.length !== 1 || failures.length !== 1) {
  throw new Error(
    `FAIL expected one winner and one failure, got winners=${winners.length} failures=${failures.length}`,
  );
}

const created = Array.isArray(winners[0].data) ? winners[0].data[0] : winners[0].data;
if (!created?.id) throw new Error("FAIL winning RPC did not return created decision");

const { data: oldDecision, error: oldError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id,status,superseded_by")
  .eq("id", decisionId)
  .single();
if (oldError) throw oldError;
if (oldDecision.status !== "superseded" || oldDecision.superseded_by !== created.id) {
  throw new Error("FAIL old decision was not superseded exactly once by the winning decision");
}

const { data: normalized, error: normalizedError } = await userA
  .from("kuanyin_plan_decisions")
  .select("title,decision_text,context,rationale,consequences,status,accepted_by,accepted_at")
  .eq("id", created.id)
  .single();
if (normalizedError) throw normalizedError;
if (normalized.title !== "Título normalizado")
  throw new Error(`FAIL title was not normalized: ${normalized.title}`);
if (normalized.decision_text !== "texto normalizado")
  throw new Error("FAIL decision_text was not normalized");
if (normalized.context !== "contexto normalizado")
  throw new Error("FAIL context was not normalized");
if (normalized.rationale !== "racional normalizado")
  throw new Error("FAIL rationale was not normalized");
if (JSON.stringify(normalized.consequences) !== JSON.stringify(["consequência normalizada"])) {
  throw new Error(
    `FAIL consequences were not normalized: ${JSON.stringify(normalized.consequences)}`,
  );
}
if (normalized.status !== "accepted" || !normalized.accepted_by || !normalized.accepted_at) {
  throw new Error("FAIL accepted supersede did not persist accepted metadata");
}

const after = await userA
  .from("kuanyin_plan_decisions")
  .select("id", { count: "exact", head: true })
  .eq("plan_id", planId);
if (after.error) throw after.error;
if ((after.count ?? 0) !== (before.count ?? 0) + 1) {
  throw new Error(
    `FAIL orphan or duplicate decision count: before=${before.count} after=${after.count}`,
  );
}

console.log("PR36 supersede concurrency, grants and normalization QA passed.");
