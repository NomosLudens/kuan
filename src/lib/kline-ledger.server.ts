import type { SupabaseClient } from "@supabase/supabase-js";

export type KlineLedgerResult =
  | { ok: true; eventId?: string }
  | { ok: false; error: string; cause?: unknown };

export async function createBoundaryHandoffCandidate(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>;
  userId: string;
  threadId?: string | null;
  targetApp: "klio-coder" | "kuan-yin";
  reason:
    | "coding_scope"
    | "personal_kaline_scope"
    | "out_of_scope"
    | "commercial_scope"
    | "legacy_klio_scope";
  latestUserText: string;
  boundaryMessage: string;
}): Promise<KlineLedgerResult> {
  const { supabase, userId, threadId, targetApp, reason, latestUserText, boundaryMessage } = input;

  try {
    const clippedText =
      latestUserText.length > 1200 ? latestUserText.slice(0, 1200) + "..." : latestUserText;

    const { data: eventData, error: eventError } = await supabase
      .from("kline_events")
      .insert({
        user_id: userId,
        event_type: "handoff.candidate",
        source_app: "kaline-clean",
        occurred_at: new Date().toISOString(),
        title: "Bloqueio de Runtime",
        body: boundaryMessage,
        payload: {
          target_app: targetApp,
          reason,
          clipped_text: clippedText,
          thread_id: threadId ?? null,
        },
      })
      .select("id")
      .single();

    if (eventError) {
      console.warn("[kline-ledger.server] Failed to create kline_events", eventError);
      return { ok: false, error: "Failed to create kline_events", cause: eventError };
    }

    const eventId = eventData?.id;
    if (!eventId) {
      console.warn("[kline-ledger.server] Event ID not returned");
      return { ok: false, error: "No event ID returned" };
    }

    const { error: reviewError } = await supabase
      .from("kline_event_review_state")
      .insert({
        user_id: userId,
        event_id: eventId,
        status: "pending",
      })
      .select("id")
      .single();

    if (reviewError) {
      console.warn("[kline-ledger.server] Failed to create kline_event_review_state", reviewError);
      return { ok: false, error: "Failed to create review state", cause: reviewError };
    }

    return { ok: true, eventId };
  } catch (err) {
    console.warn("[kline-ledger.server] Unexpected error in createBoundaryHandoffCandidate", err);
    return { ok: false, error: "Unexpected error", cause: err };
  }
}
