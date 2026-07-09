// Server-only helper: valida bearer token Supabase e retorna userId.
// Usado por rotas /api/* que consomem créditos dos provedores externos — sem isso,
// qualquer pessoa na internet pode esgotar a chave OPENROUTER_API_KEY.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function requireUser(
  request: Request,
): Promise<{ userId: string } | { error: Response }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { error: new Response("Unauthorized", { status: 401 }) };
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  const supabase = createClient<Database>(process.env.SUPABASE_URL!, supabasePublishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: new Response("Unauthorized", { status: 401 }) };
  }
  return { userId: data.user.id };
}
