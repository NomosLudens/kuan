# QA Audit Checklist: Guardian Invite Security & Session Boundary

This checklist outlines the security controls, database schemas, and manual verification procedures for the Guardian invitation and acceptance flows in Kuan-Yin.

## 1. Database Schema and Status Integrity

- [ ] **State Transitions**:
  - Initial invitation state must be `pending`.
  - Accepting an invitation must set the status to `accepted` in an atomic transaction.
  - Revoking or canceling an invitation must set the status to `revoked` or `canceled`.
  - Expired invitations must set the status to `expired`.
- [ ] **Uniqueness Constraints**:
  - The `workspace_invitations.token` column must have a unique constraint/index.
  - The `workspace_members` table must enforce uniqueness on `(owner_id, member_id)` to prevent duplicate active memberships.
- [ ] **Role Level Security (RLS)**:
  - Verify that `workspace_invitations` has RLS enabled. Only workspace owners can view, create, or update pending invitations.
  - Ensure public profiles/guests cannot read invitations directly from Supabase without passing through `checkGuardianInvitation`.

## 2. Server Function Verification & Privacy Rules

- [ ] **Read-Only Separation (`checkGuardianInvitation`)**:
  - Must NOT execute any `INSERT`, `UPDATE`, or `DELETE` statements on the database under any circumstances.
  - Must ONLY return `{ status: "auth_required" }` if the visitor is unauthenticated. No workspace details, modules, or names may be disclosed.
  - Must ONLY return `{ status: "wrong_email", userEmail, invitedEmailMasked }` if the session is active but signed in under a non-matching email address.
  - Masking must display the first and last letters of the local part of the email address (e.g., `t***s@domain.com` for `tonyus@domain.com`), or `***@***` if malformed.
- [ ] **Acceptance Guardrails (`acceptGuardianInvitation`)**:
  - Must execute all checks (matching email, status, expiration, replay) inside an atomic transaction block.
  - Replay safety check: If a user attempts to accept a token they have already accepted, it must return `{ success: true, owner_id, modules }` immediately and gracefully, without attempting to insert duplicate records or throwing errors.
  - If the active session's email (normalized) does not match the invitation's email (normalized), it must block the request and return `{ error: "wrong_email" }`.
  - Excluded admin roles: Ensure accepting a Guardian role deletes the `admin` entry from `user_roles` to demote any elevated workspace permissions for security.

## 3. Web UI / UX Flows and Open Redirect Protections

- [ ] **Open Redirect Boundaries (`getSafeRedirectUrl`)**:
  - Session redirects stored in `sessionStorage` (`authRedirectTo`) must only accept internal relative paths (starting with `/`).
  - Reject external schemas (`http://`, `https://`), protocol-relative paths (`//`), backslash evasions (`/\`), or scripts (`javascript:`).
- [ ] **UI States in `/convite`**:
  - _No session active_: Display a simple, secure warning box indicating that authentication with the invited email is required, along with an "Entrar com e-mail convidado" action button. No brand leakage or animations.
  - _Wrong session active_: Display the connected email address alongside the masked invited email address, with an option to "Sair desta conta".
  - _Correct session active_: Display a clear workspace info block with the workspace name (e.g., "Sabor de Kuan") and a high-visibility, simple "Aceitar convite" action button.
  - _After successful acceptance_: Instantly redirect to the correct canonical workspace path: `/kuan` for Kuan-Yin module, `/kharis` for Kharis, or `/chat` for default chat.

## 4. Automated & Manual Regression Tests

- [ ] **Command**: Run `bun run test` to verify unit tests for normalizations, masking, check/accept boundaries, and open redirects.
- [ ] **Manual Browser Audit**: Run `bun run dev` and navigate through the different mock invitation states in a browser incognito window to verify zero animation overhead and correct state display.
