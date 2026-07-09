import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBoundaryHandoffCandidate } from "./kline-ledger.server";

describe("kline-ledger.server", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;
  let mockInsert: any;
  let mockSelect: any;
  let mockSingle: any;

  beforeEach(() => {
    mockSingle = vi.fn().mockResolvedValue({ data: { id: "test-event-id" }, error: null });
    mockSelect = vi.fn().mockReturnValue({ single: mockSingle });

    // We need mockInsert to return an object that has a .select()
    mockInsert = vi.fn().mockReturnValue({
      select: mockSelect,
    });

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    };
  });

  it("1. cria evento handoff.candidate com target_app klio-coder", async () => {
    const res = await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "user-123",
      threadId: "thread-123",
      targetApp: "klio-coder",
      reason: "coding_scope",
      latestUserText: "me ajuda com esse código",
      boundaryMessage: "Blocked msg",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.eventId).toBe("test-event-id");
    }

    expect(mockSupabase.from).toHaveBeenCalledWith("kline_events");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "handoff.candidate",
        source_app: "kaline-clean",
        payload: expect.objectContaining({
          target_app: "klio-coder",
          reason: "coding_scope",
          thread_id: "thread-123",
          clipped_text: "me ajuda com esse código",
        }),
      }),
    );
  });

  it("2. cria evento handoff.candidate com target_app kuan-yin", async () => {
    await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "user-123",
      threadId: "thread-123",
      targetApp: "kuan-yin",
      reason: "commercial_scope",
      latestUserText: "quero montar uma página",
      boundaryMessage: "Blocked msg",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          target_app: "kuan-yin",
          reason: "commercial_scope",
        }),
      }),
    );
  });

  it("3. cria review state pending", async () => {
    await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "user-123",
      threadId: "thread-123",
      targetApp: "klio-coder",
      reason: "coding_scope",
      latestUserText: "abc",
      boundaryMessage: "Blocked msg",
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("kline_event_review_state");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "test-event-id",
        status: "pending",
        user_id: "user-123",
      }),
    );
  });

  it("4. inclui threadId como referência", async () => {
    await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "u1",
      threadId: "t-abc",
      targetApp: "klio-coder",
      reason: "coding_scope",
      latestUserText: "abc",
      boundaryMessage: "Blocked msg",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          thread_id: "t-abc",
        }),
      }),
    );
  });

  it("5. limita latestUserText longo", async () => {
    const longText = "a".repeat(2000);
    await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "u1",
      threadId: "t1",
      targetApp: "klio-coder",
      reason: "coding_scope",
      latestUserText: longText,
      boundaryMessage: "Blocked msg",
    });

    const calls = mockInsert.mock.calls;
    const eventInsert = calls.find((call: any[]) => call[0].event_type === "handoff.candidate");

    expect(eventInsert).toBeDefined();
    expect(eventInsert[0].payload.clipped_text.length).toBeLessThanOrEqual(1203);
    expect(eventInsert[0].payload.clipped_text.endsWith("...")).toBe(true);
  });

  it("6. não lança erro se Supabase falhar", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error("DB Error") });

    const res = await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "u1",
      threadId: "t1",
      targetApp: "klio-coder",
      reason: "coding_scope",
      latestUserText: "abc",
      boundaryMessage: "Blocked msg",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Failed to create kline_events");
    }
  });

  it("7. não chama update/delete", async () => {
    await createBoundaryHandoffCandidate({
      supabase: mockSupabase,
      userId: "u1",
      targetApp: "klio-coder",
      reason: "coding_scope",
      latestUserText: "abc",
      boundaryMessage: "Blocked msg",
    });

    expect(mockSupabase.from().update).toBeUndefined();
    expect(mockSupabase.from().delete).toBeUndefined();
  });
});
