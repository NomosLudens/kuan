import { describe, expect, it } from "vitest";
import {
  assertMilestoneDates,
  canTransitionDecision,
  canTransitionMilestone,
  proposedDecisionStatus,
} from "./kuan-plan.transitions";

describe("Kuan plan transitions", () => {
  it("allows and denies canonical decision transitions", () => {
    expect(canTransitionDecision("proposed", "accepted")).toBe(true);
    expect(canTransitionDecision("proposed", "superseded")).toBe(false);
    expect(canTransitionDecision("accepted", "in_review")).toBe(true);
    expect(canTransitionDecision("accepted", "superseded")).toBe(true);
    expect(canTransitionDecision("archived", "accepted")).toBe(false);
  });
  it("keeps new proposals proposed", () => {
    expect(proposedDecisionStatus()).toBe("proposed");
  });
  it("treats completed milestones as terminal and validates dates", () => {
    expect(canTransitionMilestone("completed", "in_progress")).toBe(false);
    expect(() =>
      assertMilestoneDates("2026-08-15T18:00:00-03:00", "2026-08-10T09:00:00-03:00"),
    ).toThrow();
    expect(() =>
      assertMilestoneDates("2026-08-10T09:00:00-03:00", "2026-08-15T18:00:00-03:00"),
    ).not.toThrow();
  });
});
