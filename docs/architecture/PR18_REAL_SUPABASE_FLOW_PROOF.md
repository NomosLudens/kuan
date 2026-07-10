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

## PR18 reopen — admin/Guardian account prerequisite

The previous PR18 automated checks passed, but the real manual proof is still blocked until the test account is explicitly prepared as the expected admin/Guardian account in the real Supabase project. This is an incident state for product validation: build success does not prove the Kuan-Yin flow.

### How the app determines admin/Guardian

| Mechanism | Source | Current meaning in this repo | PR18 impact |
|---|---|---|---|
| `profiles.role` | `profiles.role` text column (`admin`/`user`) | Client-side authorization/menu state reads this field and treats `admin` as full app access. New signups are not automatically admin except the first profile created by the hardened bootstrap. | The account used for manual validation must have `profiles.role = 'admin'` if it is expected to see all admin surfaces. |
| `user_roles` | `user_roles.user_id`, `user_roles.role` with enum `app_role` (`admin`/`member`) | Server-side/admin checks and `has_role()` rely on this table. | The same validation account must have `user_roles.role = 'admin'`; setting only `profiles.role` is not sufficient for server-side/admin paths. |
| `has_role()` | SQL function `public.has_role(_user_id uuid, _role public.app_role)` | Security-definer helper that returns whether a row exists in `user_roles`. It is granted to authenticated/service_role and used by RLS/admin policies outside the public Kuan-Yin chat path. | Do not remove this check and do not bypass it. Promotion must insert the explicit `user_roles` row. |
| `kuanyin_guardians.user_id` | Owner column on `kuanyin_guardians` | The owning Guardian account. Config save/upsert creates or maintains a Guardian row with `user_id` equal to the authenticated user. Public threads/messages are scoped to this Guardian. | The account validating `/kuan/config`, `/g/:slug` and `/kuan/inbox` must own the Guardian row or be the admin user for it. |
| `kuanyin_guardians.admin_user_id` | Optional admin/manager column on `kuanyin_guardians` | Allows a separate admin account to manage/read a Guardian. Kuan-Yin functions and RLS commonly accept `user_id = auth.uid()` OR `admin_user_id = auth.uid()`. | Use this only when validating an admin managing another Guardian. For the simplest PR18 proof, make the same account the owner (`user_id`) and leave `admin_user_id` null unless the scenario requires delegation. |

### Safe manual promotion SQL for the real test environment

Use this only in the Supabase SQL editor or another trusted server-side SQL channel for a known test account. Do not add it to migrations, do not run it from the frontend, and do not change signup bootstrap to make every new user admin.

Replace the email before running:

```sql
-- PR18 test-only explicit admin promotion.
-- Run in Supabase SQL editor against the intended project.
-- Replace the email with the account that will perform the manual validation.

begin;

with target_user as (
  select id
  from auth.users
  where lower(email) = lower('REPLACE_WITH_TEST_ADMIN_EMAIL@example.com')
  limit 1
), ensured_profile as (
  insert into public.profiles (id, display_name, role, assigned_facet)
  select
    target_user.id,
    'PR18 Test Admin',
    'admin',
    'kuanyin'
  from target_user
  on conflict (id) do update
    set role = 'admin',
        assigned_facet = coalesce(public.profiles.assigned_facet, 'kuanyin'),
        updated_at = now()
  returning id
)
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from ensured_profile
on conflict do nothing;

-- Verification: must return exactly one row with profile_role=admin and app_role=admin.
select
  u.id,
  u.email,
  p.role as profile_role,
  p.assigned_facet,
  ur.role as app_role
from auth.users u
join public.profiles p on p.id = u.id
left join public.user_roles ur on ur.user_id = u.id and ur.role = 'admin'
where lower(u.email) = lower('REPLACE_WITH_TEST_ADMIN_EMAIL@example.com');

commit;
```

If validation needs an existing Guardian row to be managed by this admin account instead of owned by it, link only the intended Guardian explicitly:

```sql
-- Optional delegation only for a known Guardian slug.
-- Prefer owner validation first; use this only when testing admin_user_id behavior.

update public.kuanyin_guardians kg
set admin_user_id = u.id,
    updated_at = now()
from auth.users u
where lower(u.email) = lower('REPLACE_WITH_TEST_ADMIN_EMAIL@example.com')
  and kg.public_slug = 'REPLACE_WITH_EXISTING_GUARDIAN_SLUG';

select id, user_id, admin_user_id, public_slug, status
from public.kuanyin_guardians
where public_slug = 'REPLACE_WITH_EXISTING_GUARDIAN_SLUG';
```

Safety checks before approving PR18:

- Confirm the promoted account is the intended test account.
- Confirm no signup trigger or app code was changed to grant admin broadly.
- Confirm `profiles.role = 'admin'` and `user_roles.role = 'admin'` are both present for that one account.
- Confirm the Guardian used in the test is owned by the account (`kuanyin_guardians.user_id`) or explicitly delegated to it (`kuanyin_guardians.admin_user_id`).
- Confirm the public slug is unique and belongs to the intended Guardian.

### Manual validation table to fill before approval

PR18 must not be approved until this table is completed against the real Supabase project.

| Step | Result | Evidence / Notes |
|---|---|---|
| Test account promoted explicitly | PASS/FAIL | `profiles.role`, `assigned_facet`, `user_roles.role` checked for the exact email. |
| Login | PASS/FAIL | Browser session established with promoted test account. |
| `/kuan` opens | PASS/FAIL | Authenticated route opens without role/profile error. |
| `/kuan/config` opens | PASS/FAIL | Config surface loads current/empty real `business_contexts` state. |
| `/kuan/config` saves real data | PASS/FAIL | Real `business_contexts` row exists for auth user with required business fields. |
| Guardian publish/slug | PASS/FAIL | `kuanyin_guardians.user_id` or `admin_user_id` matches test account; `public_slug` is unique; `status = 'published'`. |
| `/g/:slug` anonymous opens | PASS/FAIL | Opened in private/incognito session without login. |
| Public message saved | PASS/FAIL | Real row in `kuanyin_public_chat_messages` with role `visitor`, correct `guardian_id`, correct thread. |
| Public fallback/AI response saved | PASS/FAIL | Real row in `kuanyin_public_chat_messages` with role `kuanyin`; if OpenRouter failed, canonical fallback text was saved. |
| `/kuan/inbox` shows thread | PASS/FAIL | Thread appears only for owning/delegated Guardian account. |
| Manual reply saved | PASS/FAIL | Real `kuanyin_public_chat_messages` row with role `kuanyin` under same thread/guardian. |
| Logout/login preserves session behavior | PASS/FAIL | Logout clears session; login restores access for the same account. |
| Cross-Guardian isolation | PASS/FAIL/NOT TESTED | Attempted another Guardian slug/account if available; no data crossed Guardian boundaries. |
