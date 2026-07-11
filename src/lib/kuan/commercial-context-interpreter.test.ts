import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  interpretCommercialContext,
  type CommercialContextInterpretation,
} from "./commercial-context-interpreter";

describe("Commercial Context Interpreter Pure Tests", () => {
  // Task 9 - Check 14 & 15: Pure code imports check
  it("should not import Supabase, fetch, OpenRouter or LLM libraries", () => {
    const filePath = join(__dirname, "commercial-context-interpreter.ts");
    const content = readFileSync(filePath, "utf-8");

    expect(content).not.toContain("@supabase");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("openrouter");
    expect(content).not.toContain("client.server");
    expect(content).not.toContain("generateText");
    expect(content).not.toContain("streamText");
  });

  // Task 9 - Check 1: Guardian tone preference
  it("should classify Guardian tone preference", () => {
    const result = interpretCommercialContext({
      audience: "guardian_private",
      message: "Meus clientes gostam de atendimento informal.",
    });

    expect(result.audience).toBe("guardian_private");
    expect(result.intent).toBe("guardian_tone_preference");
    expect(result.boundary).toBe("propose_draft_update");
    expect(result.candidateUpdate).toBeDefined();
    expect(result.candidateUpdate?.target).toBe("guardian_preferences");
    expect(result.candidateUpdate?.patch).toEqual({ tone_preference: "informal" });
    expect(result.candidateUpdate?.requiresConfirmation).toBe(true);
  });

  // Task 9 - Check 2: Guardian services update
  it("should classify Guardian services update", () => {
    const result = interpretCommercialContext({
      audience: "guardian_private",
      message: "Eu faço massagem relaxante e drenagem.",
    });

    expect(result.intent).toBe("guardian_services_update");
    expect(result.boundary).toBe("propose_draft_update");
    expect(result.candidateUpdate).toBeDefined();
    expect(result.candidateUpdate?.target).toBe("business_context");
    expect(result.candidateUpdate?.requiresConfirmation).toBe(true);
  });

  // Task 9 - Check 3: Guardian availability rule (period_override)
  it("should classify Guardian availability rule as period override", () => {
    const result = interpretCommercialContext({
      audience: "guardian_private",
      message: "Essa semana atendo terça e quinta das 9h às 17h.",
    });

    expect(result.intent).toBe("guardian_availability_rule");
    expect(result.candidateUpdate).toBeDefined();
    expect(result.candidateUpdate?.target).toBe("availability_rules");
    expect(result.candidateUpdate?.patch.kind).toBe("period_override");
    expect(result.candidateUpdate?.patch.days_hint).toContain("terça");
    expect(result.candidateUpdate?.patch.days_hint).toContain("quinta");
    expect(result.candidateUpdate?.patch.start_time_hint).toBe("09:00");
    expect(result.candidateUpdate?.patch.end_time_hint).toBe("17:00");
    expect(result.candidateUpdate?.requiresConfirmation).toBe(true);
  });

  // Task 9 - Check 4: Guardian availability rule (recurring_default)
  it("should classify Guardian availability rule as recurring default", () => {
    const result = interpretCommercialContext({
      audience: "guardian_private",
      message: "Toda semana atendo terça e quinta das 9h às 17h.",
    });

    expect(result.intent).toBe("guardian_availability_rule");
    expect(result.candidateUpdate).toBeDefined();
    expect(result.candidateUpdate?.target).toBe("availability_rules");
    expect(result.candidateUpdate?.patch.kind).toBe("recurring_default");
    expect(result.candidateUpdate?.patch.days_hint).toContain("terça");
    expect(result.candidateUpdate?.patch.days_hint).toContain("quinta");
    expect(result.candidateUpdate?.patch.start_time_hint).toBe("09:00");
    expect(result.candidateUpdate?.patch.end_time_hint).toBe("17:00");
    expect(result.candidateUpdate?.requiresConfirmation).toBe(true);
  });

  // Task 9 - Check 5: Guardian page blueprint
  it("should classify Guardian public page style requests", () => {
    const result = interpretCommercialContext({
      audience: "guardian_private",
      message: "Quero uma página escura e elegante.",
    });

    expect(result.intent).toBe("guardian_public_page_request");
    expect(result.candidateUpdate).toBeDefined();
    expect(result.candidateUpdate?.target).toBe("public_page_blueprint");
    expect(result.candidateUpdate?.patch.visual_style).toBe("elegante e escura");
    expect(result.candidateUpdate?.requiresConfirmation).toBe(true);
  });

  // Task 9 - Check 6: Client appointment request
  it("should classify public client appointment request securely", () => {
    const result = interpretCommercialContext({
      audience: "public_client",
      message: "Quero agendar terça às 14h.",
    });

    expect(result.audience).toBe("public_client");
    expect(result.intent).toBe("public_appointment_request");
    expect(result.boundary).not.toBe("confirm_appointment");
    expect(result.forbiddenActions).toContain("confirm_appointment");
    expect(result.candidateUpdate).toBeUndefined();
  });

  // Task 9 - Check 7: Client payment proof
  it("should classify public client payment proof safely", () => {
    const result = interpretCommercialContext({
      audience: "public_client",
      message: "Já paguei, confirma aí?",
    });

    expect(result.intent).toBe("public_payment_proof");
    expect(result.safeReplyHint).toContain(
      "Comprovante informado não é pagamento confirmado. O Guardião precisa conferir.",
    );
    expect(result.forbiddenActions).toContain("confirm_payment");
    expect(result.candidateUpdate).toBeUndefined();
  });

  // Task 9 - Check 8: Client out of scope
  it("should classify out of scope requests and direct them to block_and_redirect", () => {
    const result = interpretCommercialContext({
      audience: "public_client",
      message: "Você pode falar comigo sobre outro assunto?",
    });

    expect(result.intent).toBe("public_out_of_scope");
    expect(result.boundary).toBe("block_and_redirect");
  });

  // Task 9 - Check 9: Client sexual content
  it("should classify sexual flirty content and block it", () => {
    const result = interpretCommercialContext({
      audience: "public_client",
      message: "Quero uma massagem com final feliz ou sexo.",
    });

    expect(result.intent).toBe("public_blocked_sensitive");
    expect(result.boundary).toBe("block_and_redirect");
  });

  // Task 9 - Check 10: Admin invite management
  it("should classify Admin invite requests", () => {
    const result = interpretCommercialContext({
      audience: "platform_admin",
      message: "Convide um novo Guardião.",
    });

    expect(result.audience).toBe("platform_admin");
    expect(result.intent).toBe("admin_invite_management");
    expect(result.boundary).toBe("suggest_next_step");
  });

  // Task 9 - Check 11 & 12 & 13: General safety boundaries
  it("should check general safety boundaries on candidate updates and public actions", () => {
    // 11. Todo candidateUpdate tem requiresConfirmation true
    const gResult1 = interpretCommercialContext({
      audience: "guardian_private",
      message: "Meus clientes gostam de atendimento informal.",
    });
    expect(gResult1.candidateUpdate?.requiresConfirmation).toBe(true);

    const gResult2 = interpretCommercialContext({
      audience: "guardian_private",
      message: "Essa semana atendo terça e quinta das 9h às 17h.",
    });
    expect(gResult2.candidateUpdate?.requiresConfirmation).toBe(true);

    // 12. public_client nunca retorna candidateUpdate
    const cResult = interpretCommercialContext({
      audience: "public_client",
      message: "Quero agendar terça às 14h.",
    });
    expect(cResult.candidateUpdate).toBeUndefined();

    // 13. public_client forbiddenActions contém confirm_appointment, confirm_payment, publish_public_page, update_business_context
    expect(cResult.forbiddenActions).toContain("confirm_appointment");
    expect(cResult.forbiddenActions).toContain("confirm_payment");
    expect(cResult.forbiddenActions).toContain("publish_public_page");
    expect(cResult.forbiddenActions).toContain("update_business_context");
  });
});
