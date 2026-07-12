import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260712002000_create_kuanyin_strategic_plan.sql",
  "utf8",
);
const functionsFile = readFileSync("src/lib/kuan-plan.functions.ts", "utf8");

describe("Kuan plan SQL and server supersede contract", () => {
  it("uses an explicit plan ownership helper in the business plan policy", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.kuanyin_can_own_plan");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain(
      "USING (public.kuanyin_can_own_plan(guardian_id, business_context_id))",
    );
    expect(migration).toContain(
      "WITH CHECK (public.kuanyin_can_own_plan(guardian_id, business_context_id))",
    );
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
    expect(migration).toContain(
      "GRANT EXECUTE\nON FUNCTION public.kuanyin_supersede_plan_decision",
    );
    expect(migration).not.toMatch(/GRANT\s+DELETE\s+ON\s+public\.kuanyin_plan_decisions/i);
  });

  it("calls the RPC without manual insert, update or delete in supersedeKuanPlanDecision", () => {
    const supersedeBody = functionsFile.slice(
      functionsFile.indexOf("export const supersedeKuanPlanDecision"),
      functionsFile.indexOf("export const createKuanPlanMilestone"),
    );

    expect(supersedeBody).toContain('.rpc(\n      "kuanyin_supersede_plan_decision"');
    expect(supersedeBody).not.toContain(".insert(");
    expect(supersedeBody).not.toContain(".update(");
    expect(supersedeBody).not.toContain(".delete(");
    expect(supersedeBody).toContain('"plan_decision_superseded"');
  });
});
