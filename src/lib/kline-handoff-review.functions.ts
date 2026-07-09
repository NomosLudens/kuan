import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";

export type HandoffTargetApp = "klio-coder" | "kuan-yin";

export type HandoffReason =
  | "coding_scope"
  | "personal_kaline_scope"
  | "out_of_scope"
  | "commercial_scope"
  | "legacy_klio_scope";

export type HandoffReviewStatus = "pending" | "approved" | "rejected" | "archived";

export type HandoffCandidate = {
  id: string;
  userId: string;
  eventType: "handoff.candidate";
  sourceApp: string;
  targetApp: HandoffTargetApp | null;
  reason: HandoffReason | null;
  title: string | null;
  body: string | null;
  clippedText: string | null;
  threadId: string | null;
  status: HandoffReviewStatus;
  createdAt: string;
  occurredAt: string;
};

const ListHandoffCandidatesInput = z.object({
  status: z.enum(["pending", "approved", "rejected", "archived"]).default("pending"),
  limit: z.number().int().min(1).max(200).default(100),
});

const ReviewHandoffCandidateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "archived"]),
  note: z.string().optional(),
});

export type KlineEventRow = {
  id: string;
  user_id: string;
  event_type: string;
  source_app: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  occurred_at: string | null;
};

export type KlineEventReviewStateRow = {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  reviewer_id: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns a map of event_id → most-recent status (rows must be pre-sorted desc by created_at). */
export function _latestReviewStatusByEventId(
  reviewStates: KlineEventReviewStateRow[],
): Map<string, HandoffReviewStatus> {
  const map = new Map<string, HandoffReviewStatus>();
  for (const rs of reviewStates) {
    if (!map.has(rs.event_id)) {
      map.set(rs.event_id, rs.status as HandoffReviewStatus);
    }
  }
  return map;
}

/** Filters events by status and respects the limit. */
export function _filterHandoffCandidatesByStatus(
  events: KlineEventRow[],
  reviewStates: KlineEventReviewStateRow[],
  status: HandoffReviewStatus,
  limit: number,
): HandoffCandidate[] {
  const statusMap = _latestReviewStatusByEventId(reviewStates);
  const candidates: HandoffCandidate[] = [];

  for (const row of events) {
    const rowStatus = statusMap.get(row.id) ?? "pending";
    if (rowStatus === status) {
      candidates.push(_normalizeHandoffCandidate(row, rowStatus));
    }
    if (candidates.length >= limit) break;
  }

  return candidates.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

/** Builds the insert payload for kline_event_review_state (append-only). */
export function _buildReviewStateInsert(opts: {
  userId: string;
  eventId: string;
  status: "approved" | "rejected" | "archived";
  note?: string | null;
}): {
  user_id: string;
  event_id: string;
  status: string;
  reviewer_id: string;
  note: string | null;
  metadata: Record<string, unknown>;
} {
  return {
    user_id: opts.userId,
    event_id: opts.eventId,
    status: opts.status,
    reviewer_id: opts.userId,
    note: opts.note ?? null,
    metadata: {},
  };
}

/** Normalizes a raw DB row into a HandoffCandidate. */
export function _normalizeHandoffCandidate(
  eventRow: KlineEventRow,
  latestReviewStatus: HandoffReviewStatus,
): HandoffCandidate {
  let targetApp: HandoffTargetApp | null = null;
  let reason: HandoffReason | null = null;
  let clippedText: string | null = null;
  let threadId: string | null = null;

  if (eventRow.payload && typeof eventRow.payload === "object") {
    const p = eventRow.payload;

    if (p.target_app === "klio-coder" || p.target_app === "kuan-yin") {
      targetApp = p.target_app;
    }

    if (
      p.reason === "coding_scope" ||
      p.reason === "personal_kaline_scope" ||
      p.reason === "out_of_scope" ||
      p.reason === "commercial_scope" ||
      p.reason === "legacy_klio_scope"
    ) {
      reason = p.reason;
    }

    if (typeof p.clipped_text === "string") {
      clippedText = p.clipped_text;
    }

    if (typeof p.thread_id === "string") {
      threadId = p.thread_id;
    }
  }

  return {
    id: eventRow.id,
    userId: eventRow.user_id,
    eventType: "handoff.candidate",
    sourceApp: eventRow.source_app,
    targetApp,
    reason,
    title: eventRow.title,
    body: eventRow.body,
    clippedText,
    threadId,
    status: latestReviewStatus,
    createdAt: eventRow.created_at,
    occurredAt: eventRow.occurred_at || eventRow.created_at,
  };
}

// ─── Server functions ──────────────────────────────────────────────────────────

export const listHandoffCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListHandoffCandidatesInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventsData, error: eventsError } = await (supabase as any)
      .from("kline_events")
      .select("*")
      .eq("user_id", userId)
      .eq("event_type", "handoff.candidate")
      .order("occurred_at", { ascending: false })
      .limit(data.limit * 5);

    if (eventsError) {
      throw new Error(`Failed to list handoff candidates: ${eventsError.message}`);
    }

    if (!eventsData || eventsData.length === 0) {
      return [];
    }

    const eventIds = eventsData.map((e: Record<string, unknown>) => String(e.id));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reviewStatesData, error: reviewError } = await (supabase as any)
      .from("kline_event_review_state")
      .select("*")
      .in("event_id", eventIds)
      .order("created_at", { ascending: false });

    if (reviewError) {
      throw new Error(`Failed to fetch review states: ${reviewError.message}`);
    }

    return _filterHandoffCandidatesByStatus(
      eventsData as KlineEventRow[],
      (reviewStatesData || []) as KlineEventReviewStateRow[],
      data.status,
      data.limit,
    );
  });

export const reviewHandoffCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewHandoffCandidateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventData, error: eventError } = await (supabase as any)
      .from("kline_events")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("event_type", "handoff.candidate")
      .single();

    if (eventError || !eventData) {
      throw new Error("Handoff candidate not found or not owned by user");
    }

    const insert = _buildReviewStateInsert({
      userId,
      eventId: data.id,
      status: data.status,
      note: data.note,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from("kline_event_review_state")
      .insert(insert);

    if (insertError) {
      throw new Error(`Failed to insert review state: ${insertError.message}`);
    }

    return _normalizeHandoffCandidate(eventData as KlineEventRow, data.status);
  });
