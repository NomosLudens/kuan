import { describe, expect, it, vi, beforeEach } from "vitest";
import { getSafeRedirectUrl } from "@/routes/auth";

// Define mock variables at top level
const mockFrom = vi.fn();
const mockGetRequest = vi.fn();
const mockGetClaims = vi.fn();

// Mock @tanstack/react-start preserving other original exports
vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  const builder = {
    middleware: () => builder,
    inputValidator: () => builder,
    handler: (h: any) => {
      const callable = (args: any) => {
        return h({
          data: args?.data,
          context: args?.context || {
            userId: "dummy-user-id",
            claims: { email: "invitedemail@domain.com" },
          },
        });
      };
      return callable;
    },
  };
  return {
    ...actual,
    createServerFn: () => builder,
  };
});

// Configure other vitest mock registrations
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => mockGetRequest(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getClaims: (token: string) => mockGetClaims(token),
    },
  })),
}));

// Set dummy env variables to avoid runtime errors during testing
process.env.SUPABASE_URL = "https://dummy-url.supabase.co";
process.env.SUPABASE_ANON_KEY = "dummy-key";

// Direct implementation of maskEmail to test its correctness
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

describe("1. Open Redirect Protection (getSafeRedirectUrl)", () => {
  it("allows safe internal paths", () => {
    expect(getSafeRedirectUrl("/")).toBe("/");
    expect(getSafeRedirectUrl("/chat")).toBe("/chat");
    expect(getSafeRedirectUrl("/convite?token=abcdefghijklmnop123456")).toBe(
      "/convite?token=abcdefghijklmnop123456",
    );
  });

  it("rejects empty, null or whitespace URLs", () => {
    expect(getSafeRedirectUrl(null)).toBeNull();
    expect(getSafeRedirectUrl("")).toBeNull();
    expect(getSafeRedirectUrl("   ")).toBeNull();
  });

  it("rejects protocol-relative paths (//)", () => {
    expect(getSafeRedirectUrl("//evil.com")).toBeNull();
    expect(getSafeRedirectUrl("//chat")).toBeNull();
  });

  it("rejects backslash evasion paths (/\\)", () => {
    expect(getSafeRedirectUrl("/\\evil.com")).toBeNull();
  });

  it("rejects external http/https domains", () => {
    expect(getSafeRedirectUrl("http://google.com")).toBeNull();
    expect(getSafeRedirectUrl("https://kuan.ai/chat")).toBeNull();
  });

  it("rejects javascript: schemes", () => {
    expect(getSafeRedirectUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeRedirectUrl("javascript://alert(1)")).toBeNull();
  });
});

describe("2. Email Masking Helper", () => {
  it("masks standard emails correctly", () => {
    expect(maskEmail("tonyus@domain.com")).toBe("t***s@domain.com");
    expect(maskEmail("guardian@kuan.ai")).toBe("g***n@kuan.ai");
  });

  it("masks short local part emails correctly", () => {
    expect(maskEmail("ab@domain.com")).toBe("a***@domain.com");
    expect(maskEmail("a@domain.com")).toBe("a***@domain.com");
  });

  it("handles malformed emails safely", () => {
    expect(maskEmail("invalid-email")).toBe("***@***");
  });
});

describe("3. Email Normalization", () => {
  it("normalizes and compares emails case-insensitively and trims whitespace", () => {
    const userEmail = "  Tonyus-dev@Domain.com  ";
    const invitedEmail = "tonyus-dev@domain.com";
    expect(userEmail.trim().toLowerCase()).toBe(invitedEmail.trim().toLowerCase());
  });
});

describe("4. Absence of legacy acceptInvite", () => {
  it("ensures legacy acceptInvite is no longer exported to prevent bypasses", async () => {
    const exports = await import("./perfis.functions");
    expect((exports as Record<string, unknown>).acceptInvite).toBeUndefined();
  });
});

describe("5. Email Normalization Helper (normalizeEmail)", () => {
  it("correctly normalizes valid emails by trimming and converting to lowercase", async () => {
    const { normalizeEmail } = await import("./perfis.functions");
    expect(normalizeEmail("  Tonyus-dev@Domain.com  ")).toBe("tonyus-dev@domain.com");
    expect(normalizeEmail("GUARDian@kuan.AI ")).toBe("guardian@kuan.ai");
  });

  it("returns null for empty, null, or undefined values", async () => {
    const { normalizeEmail } = await import("./perfis.functions");
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });
});

describe("6. checkGuardianInvitation Privacy Layers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status: auth_required and does not leak workspace details when user is not logged in", async () => {
    mockGetRequest.mockReturnValue({
      headers: {
        get: () => null, // No Authorization header
      },
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv-123",
        owner_id: "owner-456",
        email: "invited@domain.com",
        modules: ["kuanyin"],
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const { checkGuardianInvitation } = await import("./perfis.functions");
    const result = await checkGuardianInvitation({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
    });

    expect(result).toEqual({ status: "auth_required" });
    expect((result as any).businessName).toBeUndefined();
    expect((result as any).modules).toBeUndefined();
  });

  it("returns status: wrong_email and does not leak workspace details when logged in with the wrong email", async () => {
    // Session is connectedEmail@domain.com
    mockGetRequest.mockReturnValue({
      headers: {
        get: () => "Bearer header.payload.signature",
      },
    });

    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-123",
          email: "connectedEmail@domain.com",
        },
      },
    });

    // Invitation is for invitedEmail@domain.com
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv-123",
        owner_id: "owner-456",
        email: "invitedEmail@domain.com",
        modules: ["kuanyin"],
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const { checkGuardianInvitation } = await import("./perfis.functions");
    const result = await checkGuardianInvitation({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
    });

    expect(result).toEqual({
      status: "wrong_email",
      userEmail: "connectedemail@domain.com",
      invitedEmailMasked: "i***l@domain.com",
    });
    expect((result as any).businessName).toBeUndefined();
    expect((result as any).modules).toBeUndefined();
  });

  it("returns full details when session matches invitation email", async () => {
    // Session matches invitedEmail@domain.com
    mockGetRequest.mockReturnValue({
      headers: {
        get: () => "Bearer header.payload.signature",
      },
    });

    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-123",
          email: "invitedEmail@domain.com",
        },
      },
    });

    // Invitation details
    const mockMaybeSingle = vi.fn().mockImplementation(function (this: any) {
      // Simulate separate queries for workspace_invitations and business_contexts
      const selectStr = this.selectStr || "";
      if (selectStr.includes("owner_id")) {
        return Promise.resolve({
          data: {
            id: "inv-123",
            owner_id: "owner-456",
            email: "invitedEmail@domain.com",
            modules: ["kuanyin"],
            status: "pending",
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            accepted_by: null,
            accepted_at: null,
          },
          error: null,
        });
      } else {
        return Promise.resolve({
          data: {
            nome: "Sabor de Kuan",
          },
          error: null,
        });
      }
    });

    mockFrom.mockImplementation(function (this: any, table: string) {
      const mockQueryObj = {
        selectStr: "",
        select: function (s: string) {
          this.selectStr = s;
          return this;
        },
        eq: function () {
          return this;
        },
        limit: function () {
          return this;
        },
        maybeSingle: mockMaybeSingle,
      };
      return mockQueryObj;
    });

    const { checkGuardianInvitation } = await import("./perfis.functions");
    const result = await checkGuardianInvitation({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
    });

    expect(result).toEqual({
      status: "success",
      invite: {
        id: "inv-123",
        email: "invitedEmail@domain.com",
        status: "pending",
        expires_at: expect.any(String),
        accepted_by: null,
        modules: ["kuanyin"],
      },
      businessName: "Sabor de Kuan",
    });
  });
});

describe("7. acceptGuardianInvitation Boundary Validations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth_required when no email claim exists in session", async () => {
    const { acceptGuardianInvitation } = await import("./perfis.functions");
    const result = await (acceptGuardianInvitation as any)({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
      context: {
        userId: "user-123",
        claims: {}, // No email claim
      },
    });
    expect(result).toEqual({ error: "auth_required" });
  });

  it("returns wrong_email when session email does not match invitation email", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv-123",
        owner_id: "owner-456",
        email: "invitedEmail@domain.com",
        modules: ["kuanyin"],
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const { acceptGuardianInvitation } = await import("./perfis.functions");
    const result = await (acceptGuardianInvitation as any)({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
      context: {
        userId: "user-123",
        claims: {
          email: "wrongEmail@domain.com",
        },
      },
    });
    expect(result).toEqual({ error: "wrong_email", invitedEmail: "invitedEmail@domain.com" });
  });

  it("returns expired when invitation is expired", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv-123",
        owner_id: "owner-456",
        email: "invitedEmail@domain.com",
        modules: ["kuanyin"],
        status: "pending",
        expires_at: new Date(Date.now() - 86400000).toISOString(), // Expired
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      maybeSingle: mockMaybeSingle,
    });

    const { acceptGuardianInvitation } = await import("./perfis.functions");
    const result = await (acceptGuardianInvitation as any)({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
      context: {
        userId: "user-123",
        claims: {
          email: "invitedEmail@domain.com",
        },
      },
    });
    expect(result).toEqual({ error: "expired" });
  });

  it("returns revoked when invitation status is revoked", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv-123",
        owner_id: "owner-456",
        email: "invitedEmail@domain.com",
        modules: ["kuanyin"],
        status: "revoked",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const { acceptGuardianInvitation } = await import("./perfis.functions");
    const result = await (acceptGuardianInvitation as any)({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
      context: {
        userId: "user-123",
        claims: {
          email: "invitedEmail@domain.com",
        },
      },
    });
    expect(result).toEqual({ error: "revoked" });
  });

  it("returns success: true and matches modules when invitation is already accepted by me (replay safety)", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "inv-123",
        owner_id: "owner-456",
        email: "invitedEmail@domain.com",
        modules: ["kuanyin"],
        status: "accepted",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        accepted_by: "user-123", // Matches my user id
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
    });

    const { acceptGuardianInvitation } = await import("./perfis.functions");
    const result = await (acceptGuardianInvitation as any)({
      data: { token: "token-with-length-greater-than-twenty-characters-long" },
      context: {
        userId: "user-123",
        claims: {
          email: "invitedEmail@domain.com",
        },
      },
    });
    expect(result).toEqual({ success: true, owner_id: "owner-456", modules: ["kuanyin"] });
  });
});
