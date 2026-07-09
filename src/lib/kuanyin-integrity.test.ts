import { describe, expect, it } from "vitest";
import { classifyKuanyinResponse } from "./kuanyin-integrity";

describe("classifyKuanyinResponse", () => {
  it("returns no signals for benign text", () => {
    expect(
      classifyKuanyinResponse("Olá! Preparei o preview da proposta para você confirmar."),
    ).toEqual([]);
  });

  it("ignores very short / empty input", () => {
    expect(classifyKuanyinResponse("")).toEqual([]);
    expect(classifyKuanyinResponse("ok")).toEqual([]);
  });

  it("blocks treating a proof as a confirmed payment (invariante 1)", () => {
    const signals = classifyKuanyinResponse(
      "Pronto, pagamento confirmado pelo comprovante que você enviou.",
    );
    expect(signals.some((s) => s.category === "pagamento_confirmado_por_comprovante")).toBe(true);
    expect(
      signals.find((s) => s.category === "pagamento_confirmado_por_comprovante")?.severity,
    ).toBe("block");
  });

  it("is accent-insensitive (matches 'horário reservado')", () => {
    const signals = classifyKuanyinResponse("Seu horário reservado está garantido para amanhã.");
    expect(signals.some((s) => s.category === "agendamento_confirmado_por_iniciativa")).toBe(true);
  });

  it("warns on forged urgency / scarcity (invariante 7)", () => {
    const signals = classifyKuanyinResponse("Corre que vai acabar, são as últimas vagas!");
    expect(signals.some((s) => s.category === "urgencia_falsa")).toBe(true);
  });

  it("requires the 'near' context for prompt-leak detection", () => {
    // menciona o termo mas sem o contexto de auto-revelação → não dispara
    const noContext = classifyKuanyinResponse(
      "Posso te ajudar a integrar pagamentos no seu sistema.",
    );
    expect(noContext.some((s) => s.category === "vazamento_de_prompt")).toBe(false);
  });

  it("includes an excerpt with each signal", () => {
    const [signal] = classifyKuanyinResponse("Pagamento confirmado, pode deixar.");
    expect(signal).toBeDefined();
    expect(signal.excerpt.length).toBeGreaterThan(0);
  });
});
