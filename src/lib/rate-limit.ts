// Rate limit em memória, best-effort por isolate do Worker.
// Não é distribuído: em produção com múltiplos isolates a janela é por isolate.
// O relatório de segurança deixa claro que é mitigação inicial — para abuso
// global usar Cloudflare Rate Limiting ou Durable Object por usuário.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfter: number };

export function checkRateLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSec * 1000;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

// Garbage collection leve para não vazar memória entre janelas.
let lastSweep = Date.now();
function sweepExpired() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export function rateLimit(
  userId: string,
  feature: string,
  limit: number,
  windowSec = 60,
): Response | null {
  sweepExpired();
  const r = checkRateLimit(`${feature}:${userId}`, limit, windowSec);
  if (r.ok) return null;
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: `Muitas requisições em ${feature}. Tente novamente em ${r.retryAfter}s.`,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(r.retryAfter),
      },
    },
  );
}
