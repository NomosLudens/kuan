import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const historicalMigration = readFileSync(
  "supabase/migrations/20260712002000_create_kuanyin_strategic_plan.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260712004000_repair_kuan_plan_atomicity.sql",
  "utf8",
);
const hardeningMigration = readFileSync(
  "supabase/migrations/20260712003000_harden_kuan_plan_rpc_privileges.sql",
  "utf8",
);
const functionsFile = readFileSync("src/lib/kuan-plan.functions.ts", "utf8");
const normalizedMigration = migration.replace(/\s+/g, " ");

describe("Kuan plan SQL and server supersede contract", () => {
  it("keeps the historical plan migration free of the compensating RPC repair", () => {
    expect(historicalMigration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.kuanyin_supersede_plan_decision",
    );
    expect(historicalMigration).not.toContain(
      "CREATE OR REPLACE FUNCTION public.kuanyin_can_own_plan",
    );
  });

  it("uses an explicit plan ownership helper in the compensating business plan policy", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.kuanyin_can_own_plan");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain(`public.kuanyin_can_own_plan(
    guardian_id,
    business_context_id
  )`);
    expect(migration).toContain(`WITH CHECK (
  public.kuanyin_can_own_plan(
    guardian_id,
    business_context_id
  )
)`);
    expect(migration).toContain("WHERE g.id = p_guardian_id");
    expect(migration).toContain("AND g.business_context_id = p_business_context_id");
    expect(migration).toContain("AND bc.user_id = auth.uid()");
    expect(migration).not.toContain(
      "JOIN public.business_contexts bc ON bc.id = business_context_id",
    );
  });

  it("defines atomic supersede as SECURITY INVOKER and grants execute only", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.kuanyin_supersede_plan_decision",
    );
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("FOR UPDATE");
    expect(hardeningMigration).toContain("to_regprocedure");
    expect(hardeningMigration).toContain("REVOKE ALL");
    expect(migration).toContain("REVOKE ALL\nON FUNCTION public.kuanyin_supersede_plan_decision");
    expect(hardeningMigration).toContain("FROM PUBLIC");
    expect(hardeningMigration).toContain("FROM anon");
    expect(migration).toContain(
      "GRANT EXECUTE\nON FUNCTION public.kuanyin_supersede_plan_decision",
    );
    expect(hardeningMigration).toContain("TO authenticated");
    expect(hardeningMigration).not.toMatch(/GRANT\s+EXECUTE[\s\S]*TO\s+anon/i);
    expect(migration + hardeningMigration).not.toMatch(
      /GRANT\s+DELETE\s+ON\s+public\.kuanyin_plan_decisions/i,
    );
  });

  it("enforces application input limits inside the compensating RPC", () => {
    expect(normalizedMigration).toContain("char_length(btrim(p_title)) > 200");
    expect(normalizedMigration).toContain("char_length(btrim(p_decision_text)) > 4000");
    expect(normalizedMigration).toContain(
      "p_context IS NOT NULL AND char_length(btrim(p_context)) > 4000",
    );
    expect(normalizedMigration).toContain(
      "p_rationale IS NOT NULL AND char_length(btrim(p_rationale)) > 4000",
    );
    expect(normalizedMigration).toContain(
      "jsonb_array_length(COALESCE(p_consequences, '[]'::jsonb)) > 30",
    );
    expect(normalizedMigration).toContain("jsonb_typeof(item.value) <> 'string'");
    expect(normalizedMigration).toContain("char_length(btrim(item.value #>> '{}')) > 500");
  });

  it("calls the RPC without side-effect plan creation or manual insert, update or delete", () => {
    const supersedeBody = functionsFile.slice(
      functionsFile.indexOf("export const supersedeKuanPlanDecision"),
      functionsFile.indexOf("export const createKuanPlanMilestone"),
    );

    expect(supersedeBody).toContain('.rpc(\n      "kuanyin_supersede_plan_decision"');
    expect(supersedeBody).not.toContain("getOrCreatePlan");
    expect(supersedeBody).not.toContain(".insert(");
    expect(supersedeBody).not.toContain(".update(");
    expect(supersedeBody).not.toContain(".delete(");
    expect(supersedeBody).toContain('"plan_decision_superseded"');
  });
});
