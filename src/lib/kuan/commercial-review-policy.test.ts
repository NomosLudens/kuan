import { describe, expect, it } from "vitest";
import {
  validateAppointmentTransition,
  validateOrderTransition,
  validatePaymentTransition,
  CommercialReviewActor,
} from "./commercial-review-policy";

describe("PR #25 - Commercial Review & State Integrity - Unit Tests", () => {
  const mockGuardian: CommercialReviewActor = {
    actorUserId: "user-guardian-123",
    role: "guardian",
    guardianId: "guardian-abc",
  };

  const mockAdminWithScope: CommercialReviewActor = {
    actorUserId: "user-admin-456",
    role: "platform_admin",
    guardianId: "guardian-abc",
  };

  const mockAdminNoScope: CommercialReviewActor = {
    actorUserId: "user-admin-456",
    role: "platform_admin",
    guardianId: null,
  };

  const mockPublicClient: CommercialReviewActor = {
    actorUserId: "", // public clients are represented with an empty actorUserId
    role: "guardian", // or roles/scopes aren't valid
    guardianId: null,
  };

  it("1. appointment proposed → confirmed permitido para guardian", () => {
    const res = validateAppointmentTransition(
      "proposed",
      "confirmed",
      mockGuardian,
      "guardian-abc",
    );
    expect(res).toBe(true);
  });

  it("2. appointment proposed → rejected permitido para guardian", () => {
    const res = validateAppointmentTransition("proposed", "rejected", mockGuardian, "guardian-abc");
    expect(res).toBe(true);
  });

  it("3. appointment confirmed → proposed proibido", () => {
    expect(() =>
      validateAppointmentTransition("confirmed", "proposed", mockGuardian, "guardian-abc"),
    ).toThrow("Invalid appointment transition from 'confirmed' to 'proposed'.");
  });

  it("4. order proposed → accepted permitido para guardian", () => {
    const res = validateOrderTransition("proposed", "accepted", mockGuardian, "guardian-abc");
    expect(res).toBe(true);
  });

  it("5. order proposed → rejected permitido para guardian", () => {
    const res = validateOrderTransition("proposed", "rejected", mockGuardian, "guardian-abc");
    expect(res).toBe(true);
  });

  it("6. order accepted → proposed proibido", () => {
    expect(() =>
      validateOrderTransition("accepted", "proposed", mockGuardian, "guardian-abc"),
    ).toThrow("Invalid order transition from 'accepted' to 'proposed'.");
  });

  it("7. payment received_proof → verified permitido para guardian", () => {
    const res = validatePaymentTransition(
      "received_proof",
      "verified",
      mockGuardian,
      "guardian-abc",
    );
    expect(res).toBe(true);
  });

  it("8. payment received_proof → rejected permitido para guardian", () => {
    const res = validatePaymentTransition(
      "received_proof",
      "rejected",
      mockGuardian,
      "guardian-abc",
    );
    expect(res).toBe(true);
  });

  it("9. payment verified → received_proof proibido", () => {
    expect(() =>
      validatePaymentTransition("verified", "received_proof", mockGuardian, "guardian-abc"),
    ).toThrow("Invalid payment transition from 'verified' to 'received_proof'.");
  });

  it("10. public_client nunca pode confirmar", () => {
    expect(() =>
      validateAppointmentTransition("proposed", "confirmed", mockPublicClient, "guardian-abc"),
    ).toThrow("Public client or unauthenticated actor cannot make review decisions.");

    expect(() =>
      validateOrderTransition("proposed", "accepted", mockPublicClient, "guardian-abc"),
    ).toThrow("Public client or unauthenticated actor cannot make review decisions.");

    expect(() =>
      validatePaymentTransition("received_proof", "verified", mockPublicClient, "guardian-abc"),
    ).toThrow("Public client or unauthenticated actor cannot make review decisions.");
  });

  it("11. admin sem guardian scope explícito não pode decidir", () => {
    expect(() =>
      validateAppointmentTransition("proposed", "confirmed", mockAdminNoScope, "guardian-abc"),
    ).toThrow("Admin acting without explicit guardian scope is not allowed.");

    expect(() =>
      validateOrderTransition("proposed", "accepted", mockAdminNoScope, "guardian-abc"),
    ).toThrow("Admin acting without explicit guardian scope is not allowed.");

    expect(() =>
      validatePaymentTransition("received_proof", "verified", mockAdminNoScope, "guardian-abc"),
    ).toThrow("Admin acting without explicit guardian scope is not allowed.");

    // Permitted with explicit scope:
    expect(
      validateAppointmentTransition("proposed", "confirmed", mockAdminWithScope, "guardian-abc"),
    ).toBe(true);
  });

  it("12. transição desconhecida falha", () => {
    expect(() =>
      validateAppointmentTransition("proposed", "unknown_state", mockGuardian, "guardian-abc"),
    ).toThrow("Invalid appointment transition from 'proposed' to 'unknown_state'.");
  });
});
