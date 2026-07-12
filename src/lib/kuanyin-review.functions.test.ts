import { describe, expect, it } from "vitest";
import { resolveReviewActor } from "./kuanyin-review.functions";

function makeSupabase({
  ownGuardianId,
  isAdmin,
  targetGuardianIds = [],
}: {
  ownGuardianId?: string;
  isAdmin?: boolean;
  targetGuardianIds?: string[];
}) {
  return {
    from(table: string) {
      const filters: Record<string, string> = {};
      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          filters[column] = value;
          return this;
        },
        maybeSingle() {
          if (table === "kuanyin_guardians" && filters.user_id) {
            return Promise.resolve({
              data: ownGuardianId ? { id: ownGuardianId } : null,
              error: null,
            });
          }

          if (table === "kuanyin_guardians" && filters.id) {
            return Promise.resolve({
              data: targetGuardianIds.includes(filters.id) ? { id: filters.id } : null,
              error: null,
            });
          }

          if (table === "user_roles") {
            return Promise.resolve({ data: isAdmin ? { role: "admin" } : null, error: null });
          }

          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}

describe("resolveReviewActor", () => {
  it("lets an admin who is also a guardian review without explicit scope as their own guardian", async () => {
    await expect(
      resolveReviewActor(
        makeSupabase({ ownGuardianId: "guardian-a", isAdmin: true }) as any,
        "user-a",
      ),
    ).resolves.toEqual({
      actorUserId: "user-a",
      role: "guardian",
      guardianId: "guardian-a",
    });
  });

  it("requires explicit guardian scope for a pure admin", async () => {
    await expect(
      resolveReviewActor(makeSupabase({ isAdmin: true }) as any, "admin-user"),
    ).rejects.toThrow("Admin acting without explicit guardian scope is not allowed.");
  });

  it("lets an admin act as platform admin when explicit guardian scope exists", async () => {
    await expect(
      resolveReviewActor(
        makeSupabase({ isAdmin: true, targetGuardianIds: ["guardian-b"] }) as any,
        "admin-user",
        "guardian-b",
      ),
    ).resolves.toEqual({
      actorUserId: "admin-user",
      role: "platform_admin",
      guardianId: "guardian-b",
    });
  });

  it("blocks a non-admin guardian from using another guardian scope", async () => {
    await expect(
      resolveReviewActor(
        makeSupabase({ ownGuardianId: "guardian-a", targetGuardianIds: ["guardian-b"] }) as any,
        "user-a",
        "guardian-b",
      ),
    ).rejects.toThrow("Guardian can only decide items linked to their own guardianId.");
  });
});
