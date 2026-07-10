-- Kuan-Yin index proposal only.
-- This file is documentation/proposal, not an active Supabase migration.
-- Rules: additive only; no DROP, no RENAME, no destructive operation.

create index if not exists idx_kuanyin_guardians_public_slug
on public.kuanyin_guardians (public_slug);

create index if not exists idx_kuanyin_public_chat_threads_guardian_user_visitor_updated
on public.kuanyin_public_chat_threads (guardian_id, user_id, visitor_key, updated_at desc);

create index if not exists idx_kuanyin_public_chat_messages_guardian_user_thread_created
on public.kuanyin_public_chat_messages (guardian_id, user_id, thread_id, created_at);

create index if not exists idx_kuanyin_inbox_user_status_updated
on public.kuanyin_public_chat_threads (user_id, status, updated_at desc);

create index if not exists idx_kuanyin_appointments_user_status_starts
on public.kuanyin_appointments (user_id, status, starts_at);

create index if not exists idx_kuanyin_orders_user_status_created
on public.kuanyin_orders (user_id, status, created_at desc);

create index if not exists idx_kuanyin_payments_user_status_created
on public.kuanyin_payments (user_id, status, created_at desc);

create index if not exists idx_kuanyin_integrity_logs_user_created
on public.kuanyin_integrity_logs (user_id, created_at desc);
