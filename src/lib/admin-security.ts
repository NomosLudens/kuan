import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Middleware that strictly verifies if the authenticated user has the 'admin' role.
 * Depends on `requireSupabaseAuth` to obtain the decoded `supabase` client and `userId`.
 */
export const requirePlatformAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { supabase, userId } = context;

    // Verify admin role strictly on the server-side
    const { data: roleRow, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error || !roleRow) {
      console.warn(`[Security] User ${userId} attempted admin action without admin role.`);
      throw new Error(
        "Acesso negado. Esta ação requer privilégios de administrador da plataforma.",
      );
    }

    // Pass the context downstream
    return next({
      context: {
        ...context,
        isAdmin: true,
      },
    });
  });

/**
 * Validates a given URL to ensure it is safe to use as a redirect/magic link origin.
 * Rejects javascript: schemes, external domains (relative to expected origin), protocol-relative URLs, and malformed inputs.
 */
export function validateSafeRedirectUrl(targetUrl: string, expectedOrigin: string): string {
  try {
    const url = new URL(targetUrl);

    // Prevent scheme-based attacks
    if (
      url.protocol === "javascript:" ||
      url.protocol === "vbscript:" ||
      url.protocol === "data:"
    ) {
      throw new Error("Invalid URL protocol.");
    }

    const expectedUrl = new URL(expectedOrigin);

    // Prevent open redirect to external domains
    if (url.hostname !== expectedUrl.hostname) {
      throw new Error("External redirects are not allowed.");
    }

    return url.toString();
  } catch (e) {
    // If it's a relative path starting with '/', we can construct it against the expected origin
    if (targetUrl.startsWith("/") && !targetUrl.startsWith("//")) {
      const url = new URL(targetUrl, expectedOrigin);
      return url.toString();
    }
    throw new Error("URL de redirecionamento inválida ou insegura.");
  }
}

/**
 * Helper to get the canonical base URL for the application.
 */
export function getCanonicalAppUrl(requestHeaders?: Headers): string {
  if (process.env.KUAN_PUBLIC_APP_URL) {
    return process.env.KUAN_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  // Fallback to request host if available
  if (requestHeaders) {
    const host = requestHeaders.get("host") || requestHeaders.get("x-forwarded-host");
    const proto = requestHeaders.get("x-forwarded-proto") || "https";
    if (host) {
      return `${proto}://${host}`;
    }
  }

  return "https://kuan.app"; // Default safe fallback
}
