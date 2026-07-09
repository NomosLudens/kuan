// Readiness check — confirma que dependências críticas estão acessíveis.
// Mais pesado que /health: faz checks em Supabase/OpenRouter/schema. Use em smoke tests de deploy,
// não em monitores de alta frequência.
import { createFileRoute } from "@tanstack/react-router";

type Check = { ok: boolean; ms?: number; error?: string; missing?: string[] };

const EXPECTED_SCHEMA_TABLES = [
  "profiles",
  "chat_threads",
  "chat_messages",
  "jardim_memorias",
  "memory_candidates",
  "registro_vivo",
  "presenca_regimes",
  "business_contexts",
  "kuanyin_guardians",
  "kuanyin_clients",
  "kuanyin_appointments",
  "kuanyin_orders",
  "kuanyin_payments",
  "kuanyin_public_chat_threads",
  "kuanyin_public_chat_messages",
  "livros",
  "codice_margens",
  "camara_sessoes",
  "camara_segmentos",
] as const;

function envValue(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

async function checkSupabaseReachability(): Promise<Check> {
  const supabaseUrl = envValue("SUPABASE_URL");
  if (!supabaseUrl) return { ok: false, error: "supabase_not_configured" };

  const t0 = Date.now();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return { ok: res.ok, ms: Date.now() - t0, ...(res.ok ? {} : { error: `http_${res.status}` }) };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function isMissingTableStatus(status: number) {
  return status === 404 || status === 400;
}

async function checkSupabaseSchema(): Promise<Check> {
  const supabaseUrl = envValue("SUPABASE_URL");
  const supabaseKey =
    envValue("SUPABASE_SERVICE_ROLE_KEY") ??
    envValue("SUPABASE_PUBLISHABLE_KEY") ??
    envValue("SUPABASE_ANON_KEY");

  if (!supabaseUrl) return { ok: false, error: "supabase_not_configured" };
  if (!supabaseKey) return { ok: false, error: "supabase_key_not_configured" };

  const t0 = Date.now();
  const missing: string[] = [];

  try {
    for (const table of EXPECTED_SCHEMA_TABLES) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
        method: "HEAD",
        headers: {
          apikey: supabaseKey,
          authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) continue;
      if (isMissingTableStatus(res.status)) {
        missing.push(table);
        continue;
      }

      return {
        ok: false,
        ms: Date.now() - t0,
        error: `schema_probe_failed_${table}_http_${res.status}`,
      };
    }

    return {
      ok: missing.length === 0,
      ms: Date.now() - t0,
      ...(missing.length ? { error: "schema_missing_tables", missing } : {}),
    };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Detalhes de schema/latência/mensagens de erro só vazam para quem apresenta o
// segredo de deploy (KALINE_READY_SECRET via header `x-ready-secret`). Sem o
// segredo configurado ou sem o header correto, resposta pública fica em {status}.
function hasReadySecret(request: Request): boolean {
  const configured = envValue("KALINE_READY_SECRET");
  if (!configured) return false;
  const provided = request.headers.get("x-ready-secret");
  return provided === configured;
}

export const Route = createFileRoute("/api/public/ready")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const checks: Record<string, Check> = {};

        checks.supabase = await checkSupabaseReachability();
        checks.supabase_schema = await checkSupabaseSchema();
        checks.openrouter_ai = {
          ok: Boolean(process.env.OPENROUTER_API_KEY),
          ...(process.env.OPENROUTER_API_KEY ? {} : { error: "ai_not_configured" }),
        };

        const allOk = Object.values(checks).every((check) => check.ok);
        const status = allOk ? "ready" : "degraded";
        const detailed = hasReadySecret(request);

        return new Response(
          JSON.stringify(
            detailed ? { status, time: new Date().toISOString(), checks } : { status },
          ),
          {
            status: allOk ? 200 : 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
