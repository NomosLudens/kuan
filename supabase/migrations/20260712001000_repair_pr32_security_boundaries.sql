-- Compensate PR #32 security hardening without editing the historical migration.
-- Public chat access remains mediated by server functions that resolve visitorKey + threadId + guardianId + userId + businessContextId.

-- Do not repeat a schema-wide REVOKE here: PR #32 may already have done it,
-- and doing it again would keep unrelated app surfaces broken. This repair only
-- removes the unsafe public-chat policies and restores the grants directly
-- needed by Kuan flows.

DROP POLICY IF EXISTS "Public visitor can access own thread with visitor key" ON public.kuanyin_public_chat_threads;
DROP POLICY IF EXISTS "Public visitor can access own messages with visitor key" ON public.kuanyin_public_chat_messages;
DROP POLICY IF EXISTS "Guardian ownership and Visitor key matching access on threads" ON public.kuanyin_public_chat_threads;
DROP POLICY IF EXISTS "Guardian ownership and Visitor key matching access on messages" ON public.kuanyin_public_chat_messages;
DROP POLICY IF EXISTS "Guardian ownership and Visitor access on messages" ON public.kuanyin_public_chat_messages;
DROP POLICY IF EXISTS kuanyin_public_chat_threads_own_rows ON public.kuanyin_public_chat_threads;
DROP POLICY IF EXISTS kuanyin_public_chat_messages_own_rows ON public.kuanyin_public_chat_messages;

CREATE POLICY kuanyin_public_chat_threads_guardian_owner_select
  ON public.kuanyin_public_chat_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY kuanyin_public_chat_threads_guardian_owner_insert
  ON public.kuanyin_public_chat_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY kuanyin_public_chat_threads_guardian_owner_update
  ON public.kuanyin_public_chat_threads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY kuanyin_public_chat_messages_guardian_owner_select
  ON public.kuanyin_public_chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kuanyin_public_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY kuanyin_public_chat_messages_guardian_owner_insert
  ON public.kuanyin_public_chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.kuanyin_public_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY kuanyin_public_chat_messages_guardian_owner_update
  ON public.kuanyin_public_chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kuanyin_public_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kuanyin_public_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.chat_threads, public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_contexts, public.kuanyin_guardians, public.kuanyin_clients,
  public.kuanyin_appointments, public.kuanyin_orders, public.kuanyin_payments, public.kuanyin_payment_proofs,
  public.kuanyin_integrity_logs, public.kuanyin_public_chat_threads, public.kuanyin_public_chat_messages,
  public.kuanyin_portal_tokens TO authenticated;
GRANT UPDATE (display_name, avatar_url, gender, initial_surface) ON public.profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;


DO $$
DECLARE
  policy_row record;
BEGIN
  RAISE NOTICE 'kuanyin public chat policies after PR33 repair:';
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('kuanyin_public_chat_threads', 'kuanyin_public_chat_messages')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '% %.% cmd=% roles=% using=% check=%', policy_row.policyname, policy_row.schemaname, policy_row.tablename, policy_row.cmd, policy_row.roles, policy_row.qual, policy_row.with_check;
  END LOOP;
END $$;
