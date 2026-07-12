export type PlanDecisionStatus =
  | "proposed"
  | "accepted"
  | "in_review"
  | "superseded"
  | "rejected"
  | "archived";
export type PlanMilestoneStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "delayed"
  | "blocked"
  | "cancelled";

export const DECISION_TRANSITIONS: Record<PlanDecisionStatus, PlanDecisionStatus[]> = {
  proposed: ["accepted", "rejected", "archived"],
  accepted: ["in_review", "superseded", "archived"],
  in_review: ["accepted", "superseded", "archived"],
  rejected: ["archived"],
  superseded: ["archived"],
  archived: [],
};

export const MILESTONE_TRANSITIONS: Record<PlanMilestoneStatus, PlanMilestoneStatus[]> = {
  planned: ["in_progress", "completed", "delayed", "blocked", "cancelled"],
  in_progress: ["completed", "delayed", "blocked", "cancelled"],
  delayed: ["in_progress", "completed", "cancelled"],
  blocked: ["planned", "in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionDecision(from: PlanDecisionStatus, to: PlanDecisionStatus): boolean {
  return DECISION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canSupersedeDecision(status: PlanDecisionStatus): boolean {
  return status === "accepted" || status === "in_review";
}

export function canTransitionMilestone(
  from: PlanMilestoneStatus,
  to: PlanMilestoneStatus,
): boolean {
  return MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertMilestoneDates(startsAt?: string | null, dueAt?: string | null): void {
  if (!startsAt || !dueAt) return;
  const start = new Date(startsAt).getTime();
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(due) || due < start) {
    throw new Error("A data limite do marco deve ser posterior ao início.");
  }
}

export function proposedDecisionStatus(): PlanDecisionStatus {
  return "proposed";
}
