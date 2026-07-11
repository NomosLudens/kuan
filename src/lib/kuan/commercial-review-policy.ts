export type CommercialReviewActor = {
  actorUserId: string;
  role: "guardian" | "platform_admin";
  guardianId?: string | null;
};

/**
 * Validates transition for appointments.
 * Allowed: proposed -> confirmed, proposed -> rejected.
 */
export function validateAppointmentTransition(
  from: string,
  to: string,
  actor: CommercialReviewActor,
  entityGuardianId?: string | null,
): boolean {
  if (!actor.actorUserId) {
    throw new Error("Public client or unauthenticated actor cannot make review decisions.");
  }

  if (actor.role === "platform_admin" && !actor.guardianId) {
    throw new Error("Admin acting without explicit guardian scope is not allowed.");
  }

  if (actor.role === "guardian" && entityGuardianId && actor.guardianId !== entityGuardianId) {
    throw new Error("Guardian can only decide items linked to their own guardianId.");
  }

  const normalizedFrom = from.trim().toLowerCase();
  const normalizedTo = to.trim().toLowerCase();

  // Validate allowed transitions
  if (
    normalizedFrom === "proposed" &&
    (normalizedTo === "confirmed" || normalizedTo === "rejected")
  ) {
    return true;
  }

  throw new Error(`Invalid appointment transition from '${from}' to '${to}'.`);
}

/**
 * Validates transition for orders/quotes.
 * Allowed: proposed -> accepted, proposed -> rejected.
 */
export function validateOrderTransition(
  from: string,
  to: string,
  actor: CommercialReviewActor,
  entityGuardianId?: string | null,
): boolean {
  if (!actor.actorUserId) {
    throw new Error("Public client or unauthenticated actor cannot make review decisions.");
  }

  if (actor.role === "platform_admin" && !actor.guardianId) {
    throw new Error("Admin acting without explicit guardian scope is not allowed.");
  }

  if (actor.role === "guardian" && entityGuardianId && actor.guardianId !== entityGuardianId) {
    throw new Error("Guardian can only decide items linked to their own guardianId.");
  }

  const normalizedFrom = from.trim().toLowerCase();
  const normalizedTo = to.trim().toLowerCase();

  // Validate allowed transitions
  if (
    normalizedFrom === "proposed" &&
    (normalizedTo === "accepted" || normalizedTo === "rejected")
  ) {
    return true;
  }

  throw new Error(`Invalid order transition from '${from}' to '${to}'.`);
}

/**
 * Validates transition for payments/proofs.
 * Allowed: received_proof -> verified, received_proof -> rejected.
 */
export function validatePaymentTransition(
  from: string,
  to: string,
  actor: CommercialReviewActor,
  entityGuardianId?: string | null,
): boolean {
  if (!actor.actorUserId) {
    throw new Error("Public client or unauthenticated actor cannot make review decisions.");
  }

  if (actor.role === "platform_admin" && !actor.guardianId) {
    throw new Error("Admin acting without explicit guardian scope is not allowed.");
  }

  if (actor.role === "guardian" && entityGuardianId && actor.guardianId !== entityGuardianId) {
    throw new Error("Guardian can only decide items linked to their own guardianId.");
  }

  const normalizedFrom = from.trim().toLowerCase();
  const normalizedTo = to.trim().toLowerCase();

  // Validate allowed transitions
  if (
    normalizedFrom === "received_proof" &&
    (normalizedTo === "verified" || normalizedTo === "rejected")
  ) {
    return true;
  }

  throw new Error(`Invalid payment transition from '${from}' to '${to}'.`);
}
