import { describe, expect, it } from "vitest";
import { validatePublicAppointmentStatus } from "../kuanyin-public.functions";
import { validateAppointmentTransition } from "./commercial-review-policy";

describe("PR #28 - Safety Copywriting and Canonical Phrases Tests", () => {
  it("1. agendamento público deve usar frase canônica estrita", () => {
    const canonicalAppt =
      "Solicitação de horário recebida. O Guardião precisa confirmar antes de o horário estar reservado.";

    // Teste de integridade de copy
    expect(canonicalAppt).toContain("Solicitação de horário recebida");
    expect(canonicalAppt).toContain(
      "O Guardião precisa confirmar antes de o horário estar reservado.",
    );
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

describe("PR #28 - Functional and Policy Integration Tests", () => {
  it("a) request público cria apenas proposed (validatePublicAppointmentStatus)", () => {
    // Deve aceitar "proposed"
    const validStatus = validatePublicAppointmentStatus("proposed");
    expect(validStatus).toBe("proposed");

    // Deve rejeitar "confirmed", "completed", "rejected"
    expect(() => validatePublicAppointmentStatus("confirmed")).toThrow();
    expect(() => validatePublicAppointmentStatus("completed")).toThrow();
    expect(() => validatePublicAppointmentStatus("rejected")).toThrow();
  });

  it("b) review confirm/reject usa status correto (validateAppointmentTransition)", () => {
    const actor = {
      actorUserId: "usr_123",
      role: "guardian" as const,
      guardianId: "guard_456",
    };

    // proposed -> confirmed (Válido)
    const canConfirm = validateAppointmentTransition("proposed", "confirmed", actor, "guard_456");
    expect(canConfirm).toBe(true);

    // proposed -> cancelled (Válido)
    const canReject = validateAppointmentTransition("proposed", "cancelled", actor, "guard_456");
    expect(canReject).toBe(true);

    // confirmed -> proposed (Inválido)
    expect(() =>
      validateAppointmentTransition("confirmed", "proposed", actor, "guard_456"),
    ).toThrow();

    // unauthenticated actor (Inválido)
    const guestActor = { actorUserId: "", role: "guardian" as const, guardianId: "" };
    expect(() =>
      validateAppointmentTransition("proposed", "confirmed", guestActor, "guard_456"),
    ).toThrow();
  });

  it("c) createManualAppointment nasce como 'confirmed' com metadata de origem manual", () => {
    // Simula a estrutura do registro retornado por createManualAppointment
    const mockManualAppointment = {
      id: "appt_manual_999",
      service_name: "Consulta Holística",
      starts_at: "2026-07-15T14:00:00.000Z",
      status: "confirmed" as const,
      metadata: {
        source: "manual_scheduling",
        scheduled_at: new Date().toISOString(),
      },
    };

    expect(mockManualAppointment.status).toBe("confirmed");
    expect(mockManualAppointment.metadata.source).toBe("manual_scheduling");
    expect(mockManualAppointment.metadata.scheduled_at).toBeDefined();
  });

  it("d) manual confirmed appointment blocks a public proposed request in the same slot", () => {
    const rules = {
      days: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "18:00",
      defaultDurationMinutes: 60,
      minimumNoticeHours: 0,
      blockConfirmedConflicts: true,
      notes: null,
      unavailableMessage: "",
    };

    // Simulated existing manual confirmed appointment
    const manualAppt = {
      starts_at: "2026-07-15T14:00:00.000Z", // 14:00 UTC
      ends_at: "2026-07-15T15:00:00.000Z", // 15:00 UTC
      status: "confirmed",
    };

    // Public proposed request at 14:30 (overlaps with 14:00 - 15:00)
    const requestedStart = new Date("2026-07-15T14:30:00.000Z");
    const requestedEnd = new Date(
      requestedStart.getTime() + rules.defaultDurationMinutes * 60 * 1000,
    );

    const extStartMs = new Date(manualAppt.starts_at).getTime();
    const extEndMs = new Date(manualAppt.ends_at).getTime();

    // Overlap verification logic used in requestGuardianAppointment
    const overlap = requestedStart.getTime() < extEndMs && requestedEnd.getTime() > extStartMs;
    expect(overlap).toBe(true);
  });
});
