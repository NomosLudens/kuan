# Kuan v1.0 — Release Report

## Commit

- base: 2f964f2fc1ac87a2493fd1113464710d4b6da180
- head: pending after final commit
- branch: fix/finalize-kuan-v1
- PR: pending

## GitHub Actions

- verify: ⚠️ not executed remotely yet in this environment; workflow repaired with minimal permissions, pinned actions and timeout.
- database: ⚠️ not executed remotely yet in this environment; workflow now starts disposable Supabase, resets DB, audits functions/grants, creates fixtures and runs RLS/RPC/concurrency QA.
- run: ⚠️ pending remote GitHub Actions run after push/PR.

## Database

- db reset: ⚠️ not executed locally because the container does not provide Docker/Supabase CLI.
- migrations: ⚠️ covered by CI database job; local execution pending remote runner.
- functions: ⚠️ audited by `scripts/qa/kuan-v1-database-audit.sh` in CI using PostgreSQL `information_schema` after `supabase db reset`.
- grants: ⚠️ audited by `scripts/qa/kuan-v1-database-audit.sh`; PUBLIC/anon must not execute RPC, authenticated must execute.
- RLS: ⚠️ covered by authenticated A/B QA script in CI.
- A/B: ⚠️ covered by authenticated A/B QA script in CI.
- concurrency: ⚠️ covered by dedicated concurrent supersede decision in CI.
- normalization: ⚠️ covered by PostgreSQL-backed RPC QA in CI for trim and invalid payload rejection.
- orphan rows: ⚠️ covered by decision count and superseded row checks in CI.

## Runtime

- build: ✅ executed locally with `bun run build`.
- start: ✅ executed locally with `bun run start` after build.
- routes: ✅ smoke executed locally with HEAD requests for `/`, `/kuan`, and `/kuan/plano`; all returned HTTP 200.
- Cloudflare dry-run: ⚠️ not executed; `bunx wrangler --version` failed because npm registry returned 403 for `wrangler` resolution in this environment.
- Cloudflare deployment: ⚠️ not executed; production deploy intentionally not performed from this PR.

## Product flows

- private: ⚠️ browser/manual authenticated flow not executed in this environment.
- public: ⚠️ browser/manual public flow not executed in this environment.
- portal: ⚠️ browser/manual portal flow not executed in this environment.
- payments: ⚠️ browser/manual payment review not executed in this environment.
- appointments: ⚠️ browser/manual appointment review not executed in this environment.
- orders: ⚠️ browser/manual order review not executed in this environment.
- plan: ⚠️ database-backed technical plan QA covered by CI scripts; full browser/manual flow not executed.

## Mobile

- 360: ⚠️ mobile/browser real not executed; no browser automation was available in this environment.
- 390: ⚠️ mobile/browser real not executed; no browser automation was available in this environment.
- 430: ⚠️ mobile/browser real not executed; no browser automation was available in this environment.

## Known limitations

- Remote GitHub Actions status must be verified after pushing the branch and opening the PR.
- Supabase local DB reset and database QA require a runner with Supabase CLI and Docker.
- Cloudflare dry-run requires `wrangler` to be resolvable from the package registry.
- Human product homologation remains pending because real private/public/portal/payment/appointment/order/mobile flows were not manually executed here.

## Verdict

✅ Kuan v1.0 technically prepared for CI validation.  
⚠️ Final technical approval depends on green remote `verify` and `database` jobs.  
⚠️ Final human product homologation pending.
