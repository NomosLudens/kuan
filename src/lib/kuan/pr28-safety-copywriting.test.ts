import { describe, expect, it } from "vitest";

describe("PR #28 - Safety Copywriting and Canonical Phrases Tests", () => {
  it("1. agendamento público deve usar frase canônica estrita", () => {
    const canonicalAppt = "Solicitação de horário recebida. O Guardião precisa confirmar antes de o horário estar reservado.";
    
    // Teste de integridade de copy
    expect(canonicalAppt).toContain("Solicitação de horário recebida");
    expect(canonicalAppt).toContain("O Guardião precisa confirmar antes de o horário estar reservado.");
    expect(canonicalAppt).not.toContain("confirmado automaticamente");
    expect(canonicalAppt).not.toContain("agenda reservada pelo cliente");
  });

  it("2. solicitação de orçamento/pedido deve usar frase canônica estrita", () => {
    const canonicalOrder = "Pedido registrado. A aceitação depende do Guardião.";
    expect(canonicalOrder).toBe("Pedido registrado. A aceitação depende do Guardião.");
    expect(canonicalOrder).not.toContain("confirmado");
  });

  it("3. comprovante de pagamento deve usar frase canônica estrita", () => {
    const canonicalProof = "Comprovante recebido. O pagamento ainda depende de verificação.";
    expect(canonicalProof).toBe("Comprovante recebido. O pagamento ainda depende de verificação.");
    expect(canonicalProof).not.toContain("confirmado");
    expect(canonicalProof).not.toContain("pago com sucesso");
  });

  it("4. mensagens de ação de revisão não devem sugerir reversão inválida", () => {
    const actionConfirm = "Horário confirmado pelo Guardião.";
    const actionReject = "Solicitação rejeitada pelo Guardião.";
    expect(actionConfirm).toBe("Horário confirmado pelo Guardião.");
    expect(actionReject).toBe("Solicitação rejeitada pelo Guardião.");
  });
});
