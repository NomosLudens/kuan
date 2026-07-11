# KUAN_INVITE_SECURITY_CHECKLIST

This checklist provides guidelines for manual security auditing of the invitation flow, validation of database records, and cleaning up historical workspace memberships to ensure compliance with the strict security boundaries introduced in PR #27.

---

## 1. Automated Verification Criteria

- [ ] **Unauthenticated Access**: Verify that navigating to `/convite?token=<token>` while logged out blocks access and prompts for login, without displaying any business name or target email details (prevents data leakage).
- [ ] **Identity Matching**: Verify that navigating to `/convite?token=<token>` logged in as `wrong@email.com` when the invite is for `invited@email.com` shows a clear warning detailing the mismatch and masks the invited email (e.g. `i*****d@email.com`).
- [ ] **Manual Consent**: Verify that when logged in with the correct email, the invitation is NOT automatically accepted on load. The user must explicitly click the "Aceitar convite" button to trigger the server-side function.
- [ ] **Open Redirect Protection**: Verify that if `sessionStorage` has `authRedirectTo` containing an external domain or scheme (e.g. `https://malicious.com`, `//malicious.com`, or `javascript:alert(1)`), the application discards it and redirects safely to `/`.
- [ ] **Regression Check**: Verify that `/g/:guardianSlug` routes continue to work correctly and remain fully unauthenticated.

---

## 2. Server-side Verification Verification

Only `acceptGuardianInvitation` can perform mutations. Verify that `checkGuardianInvitation` remains strictly read-only:

- [ ] Does NOT update invitation status.
- [ ] Does NOT insert entries in `workspace_members`.
- [ ] Does NOT create relationships in `kuanyin_guardian`.

---

## 3. Database Audit Queries (Post-Migration Audits)

Run the following SQL queries in the Supabase console to detect and remediate historical session boundary violations (where an invite was accepted by a different email address):

### Query A: Detect Mismatched Acceptances

Identify cases where the user who accepted the invitation (`accepted_by` -> `profiles.email`) does not match the original invited email (`workspace_invitations.email`):

```sql
SELECT
  wi.id AS invitation_id,
  wi.email AS invited_email,
  p.email AS accepted_user_email,
  wi.accepted_at,
  wi.owner_id AS business_owner_id
FROM workspace_invitations wi
JOIN profiles p ON wi.accepted_by = p.id
WHERE LOWER(TRIM(wi.email)) <> LOWER(TRIM(p.email))
  AND wi.status = 'accepted';
```

### Remediation Process: Clean up Mismatched Memberships

If any mismatched acceptances are detected, perform the following steps to revoke access:

1. **Delete Workspace Membership**:
   ```sql
   DELETE FROM workspace_members
   WHERE owner_id = '<business_owner_id>'
     AND member_id = '<accepted_by_user_id>';
   ```
2. **Revert User Role & assigned_facet**:
   ```sql
   UPDATE profiles
   SET assigned_facet = NULL
   WHERE id = '<accepted_by_user_id>';
   ```
3. **Reset Invitation Status to Pending**:
   ```sql
   UPDATE workspace_invitations
   SET status = 'pending', accepted_by = NULL, accepted_at = NULL
   WHERE id = '<invitation_id>';
   ```

---

## 4. Audit Log Inspection

Ensure that logs generated during invitation attempts do not leak raw, complete tokens.

- Check server logs to ensure that only hashed/sliced tokens (e.g., `abcdefghij...`) are logged.
- Verify that one of the following observability actions is triggered correctly during testing:
  - `invite_viewed`
  - `invite_accept_blocked_no_session`
  - `invite_accept_blocked_wrong_email`
  - `invite_accept_blocked_expired`
  - `invite_accept_blocked_already_accepted`
  - `invite_accepted`
