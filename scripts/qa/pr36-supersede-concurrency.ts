import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!anonKey) throw new Error("Missing SUPABASE_ANON_KEY");

const emailA = process.env.PR36_USER_A_EMAIL;
const passwordA = process.env.PR36_USER_A_PASSWORD;
const emailB = process.env.PR36_USER_B_EMAIL;
const passwordB = process.env.PR36_USER_B_PASSWORD;
const supersedeDecisionId = process.env.PR36_DECISION_A_ID;
const concurrencyDecisionId = process.env.PR36_CONCURRENCY_DECISION_A_ID;
const normalizationDecisionId = process.env.PR36_NORMALIZATION_DECISION_A_ID;
const invalidStateDecisionId = process.env.PR36_INVALID_STATE_DECISION_A_ID;
const planId = process.env.PR36_PLAN_A_ID;
if (
  !emailA ||
  !passwordA ||
  !emailB ||
  !passwordB ||
  !supersedeDecisionId ||
  !concurrencyDecisionId ||
  !normalizationDecisionId ||
  !invalidStateDecisionId ||
  !planId
) {
  throw new Error("Missing PR36 fixture env");
}

type SupabaseClient = ReturnType<typeof createClient>;

function rpcPayload(oldDecisionId: string, title: string, acceptNow: boolean) {
  return {
    p_old_decision_id: oldDecisionId,
    p_title: title,
    p_decision_type: "strategy",
    p_context: "  contexto normalizado  ",
    p_decision_text: "  texto normalizado  ",
    p_rationale: "  racional normalizado  ",
    p_consequences: ["  consequência normalizada  "],
    p_priority: "medium",
    p_review_at: null,
    p_accept_now: acceptNow,
  };
}

async function signedClient(email: string, password: string) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function countPlanDecisions(client: SupabaseClient) {
  const { count, error } = await client
    .from("kuanyin_plan_decisions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  if (error) throw error;
  return count ?? 0;
}

async function assertRejectedWithoutInsert(
  label: string,
  client: SupabaseClient,
  oldDecisionId: string,
  payload: Record<string, unknown>,
) {
  const before = await countPlanDecisions(client);
  const result = await client.rpc("kuanyin_supersede_plan_decision", payload);
  const after = await countPlanDecisions(client);
  if (!result.error) throw new Error(`FAIL ${label}: RPC unexpectedly succeeded`);
  if (after !== before)
    throw new Error(`FAIL ${label}: decision count changed ${before} -> ${after}`);

  const { data: oldDecision, error } = await client
    .from("kuanyin_plan_decisions")
    .select("id,status,superseded_by")
    .eq("id", oldDecisionId)
    .single();
  if (error) throw error;
  if (oldDecision.status === "superseded" || oldDecision.superseded_by) {
    throw new Error(`FAIL ${label}: old decision was mutated`);
  }
  console.log(`PASS ${label}: ${result.error.message}`);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const anonResult = await anon.rpc(
  "kuanyin_supersede_plan_decision",
  rpcPayload(supersedeDecisionId, "Anon bloqueado", false),
);
if (!anonResult.error) throw new Error("FAIL anon executed kuanyin_supersede_plan_decision");
console.log(`PASS anon cannot execute RPC: ${anonResult.error.message}`);

const userA = await signedClient(emailA, passwordA);
const userB = await signedClient(emailB, passwordB);
const { data: authData, error: userError } = await userA.auth.getUser();
if (userError || !authData.user) throw userError ?? new Error("Missing user A session");

const proposedBefore = await countPlanDecisions(userA);
const proposedResult = await userA.rpc(
  "kuanyin_supersede_plan_decision",
  rpcPayload(supersedeDecisionId, "   Proposta normalizada   ", false),
);
if (proposedResult.error) throw proposedResult.error;
const proposed = Array.isArray(proposedResult.data) ? proposedResult.data[0] : proposedResult.data;
if (!proposed?.id) throw new Error("FAIL proposed RPC did not return created decision");
const proposedAfter = await countPlanDecisions(userA);
if (proposedAfter !== proposedBefore + 1) throw new Error("FAIL proposed RPC count mismatch");
const { data: proposedRow, error: proposedRowError } = await userA
  .from("kuanyin_plan_decisions")
  .select("status,accepted_by,accepted_at")
  .eq("id", proposed.id)
  .single();
if (proposedRowError) throw proposedRowError;
if (proposedRow.status !== "proposed" || proposedRow.accepted_by || proposedRow.accepted_at) {
  throw new Error("FAIL accept_now=false did not persist proposed metadata");
}
console.log("PASS authenticated owner can supersede as proposed");

await assertRejectedWithoutInsert(
  "invalid state cannot be superseded",
  userA,
  invalidStateDecisionId,
  rpcPayload(invalidStateDecisionId, "Estado inválido", false),
);

const crossTenantResult = await userB.rpc(
  "kuanyin_supersede_plan_decision",
  rpcPayload(normalizationDecisionId, "Tentativa cross-tenant", false),
);
if (!crossTenantResult.error) throw new Error("FAIL B superseded A decision");
const { data: normalizationStillOwned, error: normalizationStillOwnedError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id,status,superseded_by")
  .eq("id", normalizationDecisionId)
  .single();
if (normalizationStillOwnedError) throw normalizationStillOwnedError;
if (normalizationStillOwned.status !== "accepted" || normalizationStillOwned.superseded_by) {
  throw new Error("FAIL cross-tenant attempt mutated A decision");
}
console.log(`PASS B cannot supersede A decision: ${crossTenantResult.error.message}`);

const invalidPayloads: Array<[string, Record<string, unknown>]> = [
  ["empty title", { ...rpcPayload(normalizationDecisionId, " ", false) }],
  ["long title", { ...rpcPayload(normalizationDecisionId, "x".repeat(201), false) }],
  [
    "long decision_text",
    { ...rpcPayload(normalizationDecisionId, "Título", false), p_decision_text: "x".repeat(4001) },
  ],
  [
    "long context",
    { ...rpcPayload(normalizationDecisionId, "Título", false), p_context: "x".repeat(4001) },
  ],
  [
    "long rationale",
    { ...rpcPayload(normalizationDecisionId, "Título", false), p_rationale: "x".repeat(4001) },
  ],
  [
    "too many consequences",
    {
      ...rpcPayload(normalizationDecisionId, "Título", false),
      p_consequences: Array.from({ length: 31 }, (_, i) => `item ${i}`),
    },
  ],
  [
    "non-string consequence",
    { ...rpcPayload(normalizationDecisionId, "Título", false), p_consequences: [123] },
  ],
  [
    "empty consequence",
    { ...rpcPayload(normalizationDecisionId, "Título", false), p_consequences: [" "] },
  ],
  [
    "long consequence",
    { ...rpcPayload(normalizationDecisionId, "Título", false), p_consequences: ["x".repeat(501)] },
  ],
];
for (const [label, payload] of invalidPayloads) {
  await assertRejectedWithoutInsert(
    `normalization rejects ${label}`,
    userA,
    normalizationDecisionId,
    payload,
  );
}

const before = await countPlanDecisions(userA);
const [first, second] = await Promise.allSettled([
  userA.rpc(
    "kuanyin_supersede_plan_decision",
    rpcPayload(concurrencyDecisionId, "   Título normalizado A   ", true),
  ),
  userA.rpc(
    "kuanyin_supersede_plan_decision",
    rpcPayload(concurrencyDecisionId, "   Título normalizado B   ", true),
  ),
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
  .eq("id", concurrencyDecisionId)
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
if (!["Título normalizado A", "Título normalizado B"].includes(normalized.title)) {
  throw new Error(`FAIL title was not normalized: ${normalized.title}`);
}
if (normalized.decision_text !== "texto normalizado") {
  throw new Error("FAIL decision_text was not normalized");
}
if (normalized.context !== "contexto normalizado")
  throw new Error("FAIL context was not normalized");
if (normalized.rationale !== "racional normalizado")
  throw new Error("FAIL rationale was not normalized");
if (JSON.stringify(normalized.consequences) !== JSON.stringify(["consequência normalizada"])) {
  throw new Error(
    `FAIL consequences were not normalized: ${JSON.stringify(normalized.consequences)}`,
  );
}
if (
  normalized.status !== "accepted" ||
  normalized.accepted_by !== authData.user.id ||
  !normalized.accepted_at
) {
  throw new Error("FAIL accepted supersede did not persist accepted metadata");
}

const after = await countPlanDecisions(userA);
if (after !== before + 1) {
  throw new Error(`FAIL orphan or duplicate decision count: before=${before} after=${after}`);
}

const { data: orphanSuperseders, error: orphanError } = await userA
  .from("kuanyin_plan_decisions")
  .select("id")
  .eq("plan_id", planId)
  .eq("status", "superseded")
  .is("superseded_by", null);
if (orphanError) throw orphanError;
if (orphanSuperseders && orphanSuperseders.length > 0) {
  throw new Error("FAIL superseded orphan rows found");
}

console.log("PR36 supersede concurrency, grants, RPC and normalization QA passed.");
