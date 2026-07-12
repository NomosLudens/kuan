import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = "Pr36-local-fixture-password-1";
const users = [
  { key: "A", email: "pr36.guardian.a@example.test", slug: "pr36-guardian-a" },
  { key: "B", email: "pr36.guardian.b@example.test", slug: "pr36-guardian-b" },
] as const;

type Fixture = {
  email: string;
  password: string;
  userId: string;
  businessContextId: string;
  guardianId: string;
  planId: string;
  decisionId: string;
  isolationDecisionId: string;
  supersedeDecisionId: string;
  concurrencyDecisionId: string;
  normalizationDecisionId: string;
  invalidStateDecisionId: string;
  clientId: string;
};

async function resetExisting(email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const existing = data.users.find((user) => user.email === email);
  if (existing) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) throw deleteError;
  }
}

async function insertSingle<T>(table: string, values: Record<string, unknown>, select = "*") {
  const { data, error } = await admin.from(table).insert(values).select(select).single<T>();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

const fixtures: Record<"A" | "B", Fixture> = {} as Record<"A" | "B", Fixture>;

for (const user of users) {
  await resetExisting(user.email);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;
  if (!created.user) throw new Error(`User ${user.email} was not created`);

  const business = await insertSingle<{ id: string }>(
    "business_contexts",
    {
      user_id: created.user.id,
      nome: `PR36 Negócio ${user.key}`,
      tipo: "qa",
      servicos: [{ nome: "Sessão estratégica" }],
      precos: { sessao: 10000 },
      formas_pagamento: ["pix"],
      regras_agenda: { duracoes: [30, 45] },
      limites_decisao: { requer_confirmacao: true },
    },
    "id",
  );

  const guardian = await insertSingle<{ id: string }>(
    "kuanyin_guardians",
    {
      user_id: created.user.id,
      business_context_id: business.id,
      public_slug: user.slug,
      status: "published",
    },
    "id",
  );

  const client = await insertSingle<{ id: string }>(
    "kuanyin_clients",
    {
      user_id: created.user.id,
      business_context_id: business.id,
      nome: `Cliente ${user.key}`,
      email: `cliente.${user.key.toLowerCase()}@example.test`,
      status: "confirmed",
    },
    "id",
  );

  const plan = await insertSingle<{ id: string }>(
    "kuanyin_business_plans",
    {
      guardian_id: guardian.id,
      business_context_id: business.id,
      title: `Plano ${user.key}`,
      status: "active",
      created_by: created.user.id,
      updated_by: created.user.id,
    },
    "id",
  );

  async function createDecision(label: string, status = "accepted") {
    return insertSingle<{ id: string }>(
      "kuanyin_plan_decisions",
      {
        plan_id: plan.id,
        title: `${label} ${user.key}`,
        decision_type: "strategy",
        decision_text: `${label} do Guardião ${user.key}`,
        consequences: ["Manter foco"],
        priority: "medium",
        status,
        accepted_by: status === "accepted" ? created.user.id : null,
        accepted_at: status === "accepted" ? new Date().toISOString() : null,
      },
      "id",
    );
  }

  const isolationDecision = await createDecision("Decisão isolamento");
  const supersedeDecision = await createDecision("Decisão supersede");
  const concurrencyDecision = await createDecision("Decisão concorrência");
  const normalizationDecision = await createDecision("Decisão normalização");
  const invalidStateDecision = await createDecision("Decisão estado inválido", "proposed");

  fixtures[user.key] = {
    email: user.email,
    password,
    userId: created.user.id,
    businessContextId: business.id,
    guardianId: guardian.id,
    planId: plan.id,
    decisionId: isolationDecision.id,
    isolationDecisionId: isolationDecision.id,
    supersedeDecisionId: supersedeDecision.id,
    concurrencyDecisionId: concurrencyDecision.id,
    normalizationDecisionId: normalizationDecision.id,
    invalidStateDecisionId: invalidStateDecision.id,
    clientId: client.id,
  };
}

const envs = {
  PR33_USER_A_EMAIL: fixtures.A.email,
  PR33_USER_A_PASSWORD: fixtures.A.password,
  PR33_USER_B_EMAIL: fixtures.B.email,
  PR33_USER_B_PASSWORD: fixtures.B.password,
  PR33_PLAN_A_ID: fixtures.A.planId,
  PR33_PLAN_B_ID: fixtures.B.planId,
  PR33_DECISION_A_ID: fixtures.A.isolationDecisionId,
  PR36_USER_A_EMAIL: fixtures.A.email,
  PR36_USER_A_PASSWORD: fixtures.A.password,
  PR36_USER_B_EMAIL: fixtures.B.email,
  PR36_USER_B_PASSWORD: fixtures.B.password,
  PR36_PLAN_A_ID: fixtures.A.planId,
  PR36_DECISION_A_ID: fixtures.A.supersedeDecisionId,
  PR36_CONCURRENCY_DECISION_A_ID: fixtures.A.concurrencyDecisionId,
  PR36_NORMALIZATION_DECISION_A_ID: fixtures.A.normalizationDecisionId,
  PR36_INVALID_STATE_DECISION_A_ID: fixtures.A.invalidStateDecisionId,
};

if (process.env.GITHUB_ENV) {
  const fs = await import("node:fs");
  fs.appendFileSync(
    process.env.GITHUB_ENV,
    Object.entries(envs)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
  );
}

console.log(JSON.stringify({ planA: fixtures.A.planId, planB: fixtures.B.planId }, null, 2));
