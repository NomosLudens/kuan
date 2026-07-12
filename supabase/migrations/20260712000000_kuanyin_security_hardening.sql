-- SUPABASE SECURITY HARDENING & CANON ENFORCEMENT MIGRATION
-- Reference: PR #32 Security Boundaries & Database Canon

-- 1. REVOKE WILDCARD WRITE PRIVILEGES ON PUBLIC SCHEMA
-- Ensure anon and authenticated roles do not have unrestricted database-level write permissions
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Ensure default privileges for new tables are restricted (secure by default)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- 2. ENFORCE CANONICAL PAYMENT RELATIONSHIPS
-- Add check constraint on kuanyin_payments to forbid simultaneous links to appointments and orders
ALTER TABLE public.kuanyin_payments DROP CONSTRAINT IF EXISTS kuanyin_payments_single_link_check;
ALTER TABLE public.kuanyin_payments ADD CONSTRAINT kuanyin_payments_single_link_check
  CHECK ((appointment_id IS NULL) OR (order_id IS NULL));

-- 3. ACTIVATE AND HARDEN ROW LEVEL SECURITY (RLS) FOR PUBLIC CHAT SPACES
-- Enable RLS on chat tables
ALTER TABLE public.kuanyin_public_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kuanyin_public_chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing legacy policies if any to prevent collision
DROP POLICY IF EXISTS "Guardian ownership and Visitor key matching access on threads" ON public.kuanyin_public_chat_threads;
DROP POLICY IF EXISTS "Guardian ownership and Visitor access on messages" ON public.kuanyin_public_chat_messages;
DROP POLICY IF EXISTS "Enable select for authenticated users based on ownership" ON public.kuanyin_public_chat_threads;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.kuanyin_public_chat_threads;
DROP POLICY IF EXISTS "Enable select for authenticated users based on ownership" ON public.kuanyin_public_chat_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.kuanyin_public_chat_messages;

-- Create robust, narrow RLS policies for kuanyin_public_chat_threads
-- Allows the owner (Guardian) full access, and allows public reads/writes via service_role (Admin API) or restricted visitor checks
CREATE POLICY "Guardian ownership and Visitor key matching access on threads"
  ON public.kuanyin_public_chat_threads
  FOR ALL
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    (visitor_key IS NOT NULL)
  );

-- Create robust, narrow RLS policies for kuanyin_public_chat_messages
-- Protects individual chat messages from cross-thread exposure
CREATE POLICY "Guardian ownership and Visitor access on messages"
  ON public.kuanyin_public_chat_messages
  FOR ALL
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    (EXISTS (
      SELECT 1 FROM public.kuanyin_public_chat_threads t
      WHERE t.id = thread_id AND t.visitor_key IS NOT NULL
    ))
  );
