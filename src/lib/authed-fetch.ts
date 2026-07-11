import { supabase } from "@/integrations/supabase/client";
import { handleAuthSessionExpiry } from "@/lib/utils";

let activeRefreshPromise: Promise<string | null> | null = null;

async function getOrRefreshSessionToken(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      let session = data.session;
      if (!session) return null;

      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt - Date.now() / 1000 < 10) {
        console.log("[authedFetch] Token close to expiry, refreshing...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        session = refreshData.session;
      }
      return session?.access_token ?? null;
    } catch (err) {
      console.warn("[authedFetch] Session check failed, trying hard refresh:", err);
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        return data.session?.access_token ?? null;
      } catch (refreshErr) {
        console.error("[authedFetch] Refresh failed completely:", refreshErr);
        await handleAuthSessionExpiry();
        return null;
      }
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  let token = await getOrRefreshSessionToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(input, { ...init, headers });

  // Retry at most once only if the response is unauthorized/expired JWT
  if (res.status === 401) {
    console.warn("[authedFetch] Received 401, attempting token refresh and retry...");

    if (!activeRefreshPromise) {
      activeRefreshPromise = (async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) throw error;
          return data.session?.access_token ?? null;
        } catch (refreshErr) {
          console.error("[authedFetch] Refresh failed during retry:", refreshErr);
          await handleAuthSessionExpiry();
          return null;
        } finally {
          activeRefreshPromise = null;
        }
      })();
    }

    token = await activeRefreshPromise;
    if (token) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Authorization", `Bearer ${token}`);
      res = await fetch(input, { ...init, headers: retryHeaders });
    }
  }

  return res;
}
