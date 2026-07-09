// Wrap fetch para chamar nossas próprias rotas /api/* protegidas, anexando o
// access token Supabase atual como Authorization: Bearer.
import { supabase } from "@/integrations/supabase/client";

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
