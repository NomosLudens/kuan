# PR18 — Real Supabase Compatibility & Flow Proof

This PR is not a feature expansion. It documents and keeps the smallest compatibility fixes needed to prove the real Kuan-Yin flow against the commercial Supabase schema.

## Validated flow

Canonical flow:

1. Login.
2. Open authenticated `/kuan`.
3. Open onboarding/config (`/kuan/onboarding` when used, then `/kuan/config`).
4. Save a real `business_contexts` row.
5. Publish or maintain a `kuanyin_guardians` row with `user_id` equal to the authenticated user.
6. Generate a unique `public_slug`.
7. Open public `/g/:guardianSlug` without login.
8. Start public chat.
9. Save a real `kuanyin_public_chat_threads` row.
10. Save real `kuanyin_public_chat_messages` rows.
11. View the same thread in `/kuan/inbox` as the owning Guardian.
12. Reply manually as the Guardian.

Compatibility route: `/kuan-yin` redirects to canonical `/kuan`.

## Files participating in the flow

- `src/routes/auth.tsx`: login/logout entry surface.
- `src/routes/_authenticated/route.tsx`: authenticated shell and session-dependent route boundary.
- `src/routes/_authenticated/kuan.tsx`: canonical authenticated Kuan-Yin layout.
- `src/routes/_authenticated/kuan.index.tsx`: `/kuan` landing page.
- `src/routes/_authenticated/kuan-yin.tsx`: compatibility redirect to `/kuan`.
- `src/routes/_authenticated/kuan.onboarding.tsx`: onboarding entry that saves an initial business context.
- `src/routes/_authenticated/kuan.config.tsx`: business context and public slug editor.
- `src/routes/g.$guardianId.tsx`: public Guardian page; route path is `/g/$guardianId` and the parameter is used as the public slug.
- `src/routes/_authenticated/kuan.inbox.tsx`: Guardian inbox and manual replies.
- `src/lib/kuanyin.functions.ts`: authenticated server functions for context, guardian publication and commercial records.
- `src/lib/kuanyin-public.functions.ts`: public server functions for page lookup, public chat, appointments, orders and payment proof intake.
- `src/lib/kuanyin-inbox.functions.ts`: authenticated inbox server functions.
- `src/lib/kuanyin-integrity.ts`: integrity log severity normalization and invariant logging.
- `supabase/migrations/20260702010000_clean_baseline_v2.sql`: current commercial schema baseline.

## Existing routes

Required routes already exist:

- `/kuan`
- `/kuan/onboarding`
- `/kuan/config`
- `/kuan/inbox`
- `/kuan-yin` → redirects to `/kuan`
- `/g/:guardianSlug` through the file route `/g/$guardianId`

Related Kuan-Yin routes also exist for commercial operations: `/kuan/clientes`, `/kuan/agendamentos`, `/kuan/pedidos`, `/kuan/pagamentos`, `/kuan/revisao`, `/kuan/guardioes` and `/kuan/showroom`.

## Existing server functions

Authenticated core:

- `getBusinessContext`
- `upsertBusinessContext`
- `listKuanYinGuardians`
- `updateKuanYinGuardianStatus`
- `listKuanYinPublicConversations`
- `getKuanYinPublicConversation`
- `createKuanYinGuardianInvite`

Public flow:

- `getGuardianPublicPage`
- `getGuardianPublicConversation`
- `sendGuardianPublicMessage`
- `requestGuardianAppointment`
- `requestGuardianOrder`
- `submitGuardianPublicProof`

Inbox:

- `listGuardianInboxThreads`
- `getGuardianInboxThread`
- `sendGuardianManualReply`
- `setGuardianThreadStatus`

## Tables used by each flow

| Flow | Tables |
|---|---|
| Login/session | Supabase Auth, `profiles`, `user_roles` where required by the authenticated shell/authorization helpers |
| Business config | `business_contexts`, `kuanyin_guardians` |
| Public Guardian page | `kuanyin_guardians`, `business_contexts` |
| Public chat | `kuanyin_guardians`, `business_contexts`, `kuanyin_public_chat_threads`, `kuanyin_public_chat_messages` |
| Inbox/manual reply | `kuanyin_guardians`, `kuanyin_public_chat_threads`, `kuanyin_public_chat_messages`, `kuanyin_integrity_logs` |
| Appointment request | `kuanyin_clients`, `kuanyin_appointments` |
| Order request | `kuanyin_clients`, `kuanyin_orders` |
| Payment proof | `kuanyin_clients`, `kuanyin_payments` |

## Schema/status compatibility

### Payment status

Canonical status for a newly submitted public payment proof is `received_proof`.

Accepted legacy/current values documented by the baseline schema:

- `received_proof` — canonical new public proof awaiting Guardian review.
- `pending` — legacy pending-review value accepted for compatibility.
- `verified` — reviewed and accepted by the Guardian/admin path.
- `rejected` — reviewed and rejected by the Guardian/admin path.

`pending_review` is treated as a legacy product wording, not the current database value. This PR does not add a migration for it because the live schema check constraint already accepts `received_proof`, `pending`, `verified` and `rejected`.

### Integrity severity

Canonical database severities are:

- `info`
- `warn`
- `block`

Legacy product/API aliases accepted by application code:

- `warning` → normalized to `warn`
- `critical` → normalized to `block`

The application writes canonical database values so `kuanyin_integrity_logs` does not fail the baseline check constraint.

## Compatibility strategy

- Keep canonical tables and routes unchanged.
- Use `business_contexts` JSON/object columns for business rules, pricing, decision limits and escalation rules.
- Keep public lookup through `kuanyin_guardians.public_slug`.
- Scope public chat by `guardian_id` and `user_id`.
- Scope inbox reads and writes to the authenticated Guardian owner.
- If OpenRouter is missing or fails, save the visitor message and persist an honest assistant fallback: `Não consegui gerar a resposta automática agora. A mensagem foi mantida para atendimento humano.`

## Divergences found during audit

- Integrity logging used product aliases `warning`/`critical` while the baseline schema accepts `warn`/`block`.
- Public AI fallback copy was truthful but not the required canonical fallback sentence.
- The public route filename and parameter name use `guardianId`, while the product language calls it `guardianSlug`; behavior remains slug-compatible and no route redesign was made.

## Mock/placeholder/hardcoded audit

- Required Kuan-Yin real flow does not use mock success data.
- UI placeholders exist only as form examples and empty states.
- No `setTimeout` was found in the required Kuan-Yin flow files.
- Public chat persists the visitor message before attempting OpenRouter, so OpenRouter absence is not presented as product success.

## Cross-Guardian isolation risks and controls

Controls in the current flow:

- Public thread creation stores `guardian_id`, `user_id` and `business_context_id` together.
- Public thread reuse requires the same `guardian_id` and `user_id`.
- Inbox list/detail/reply filters by authenticated `user_id`.
- Manual reply reads the thread under authenticated ownership before writing with `supabaseAdmin`.

Known risk to keep watching: any future admin/shared-guardian feature must continue checking both Guardian ownership and intended module scope before using service-role writes.

## OpenRouter failure mode

OpenRouter can fail when environment variables are missing, the provider rejects a request, quota is exhausted, the model is unavailable or network/runtime errors occur.

Honest fallback: save the visitor message, write a `kuanyin` message with the canonical fallback, and leave the conversation visible in `/kuan/inbox` for human handling.

## Minimum diff used

- Normalize integrity severity aliases to canonical database values.
- Use the required honest public-chat fallback for missing/failing OpenRouter.
- Add this PR18 proof document.

## Known limits

- Manual browser validation depends on real Supabase credentials and test accounts available in the runtime environment.
- `/g/$guardianId` remains the route filename/param while serving the required `/g/:guardianSlug` public behavior.
- This PR does not add payment confirmation, appointment confirmation, external integrations, dashboards, fake metrics or schema migrations.

## Not implemented in this PR

- No new dashboard.
- No fake metrics.
- No mock data as a success state.
- No route redesign.
- No table rename.
- No broad refactor.
- No payment confirmation.
- No appointment confirmation.
- No external integration.
- No frontend secrets or service-role exposure.
