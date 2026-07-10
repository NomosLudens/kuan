# Kuan Query Optimization

## Escopo

Mapeamento de queries críticas comerciais da Kuan-Yin. Este documento recomenda índices aditivos e pequenas proteções de listagem; não aplica migration real.

## 1. Public page por slug

- Arquivo: `src/lib/kuanyin-public.functions.ts`
- Função: `loadBusinessContext` / `getGuardianPublicPage`
- Query: `kuanyin_guardians.select(id, user_id, business_context_id, public_slug, status).eq(public_slug, slug).maybeSingle()` seguida por `business_contexts.eq(id, business_context_id)`.
- Index recomendado: `idx_kuanyin_guardians_public_slug on kuanyin_guardians(public_slug)`.
- Já existe? sim no baseline via `UNIQUE (public_slug)`; desconhecido no Supabase comercial real.
- Risco se não existir: lookup público por slug degrada conforme número de Guardiões cresce.
- Prioridade: P1.

## 2. Public chat thread por guardian_id + visitor_key

- Arquivo: `src/lib/kuanyin-public.functions.ts`
- Função: `resolvePublicChatThread`
- Query: `kuanyin_public_chat_threads.eq(guardian_id).eq(user_id).eq(visitor_key).order(updated_at desc).limit(1).maybeSingle()`.
- Index recomendado: `idx_kuanyin_public_chat_threads_guardian_user_visitor_updated on (guardian_id, user_id, visitor_key, updated_at desc)`.
- Já existe? parcial no baseline: `(guardian_id, visitor_key) where visitor_key is not null`, sem `user_id`/`updated_at` composto.
- Risco se não existir: conversa pública recorrente fica mais lenta e depende de sort por updated_at.
- Prioridade: P0.

## 3. Public chat messages por guardian_id + thread_id + created_at

- Arquivo: `src/lib/kuanyin-public.functions.ts`
- Função: `loadPublicChatMessages`
- Query: `kuanyin_public_chat_messages.eq(guardian_id).eq(user_id).eq(thread_id).order(created_at desc).limit(n)`.
- Index recomendado: `idx_kuanyin_public_chat_messages_guardian_user_thread_created on (guardian_id, user_id, thread_id, created_at)`.
- Já existe? parcial no baseline: `(thread_id, created_at)`.
- Risco se não existir: histórico público pode filtrar por thread e depois conferir ownership sem índice composto completo.
- Prioridade: P0.

## 4. Inbox por user_id + status + updated_at

- Arquivo: `src/lib/kuanyin-inbox.functions.ts`
- Função: `listGuardianInboxThreads`
- Query: `kuanyin_public_chat_threads.eq(user_id).eq(status opcional).order(updated_at desc).limit(100)`.
- Index recomendado: `idx_kuanyin_inbox_user_status_updated on (user_id, status, updated_at desc)`.
- Já existe? parcial no baseline: `(user_id, updated_at desc)`.
- Risco se não existir: inbox com filtro de status degrada e ordena mais linhas que o necessário.
- Prioridade: P0.

## 5. Review Center por user_id + status

- Arquivo: `src/lib/kuanyin-review.functions.ts`
- Função: `getPendingReviews`
- Query: quatro consultas por `user_id` e `status` em `kuanyin_clients`, `kuanyin_appointments`, `kuanyin_orders`, `kuanyin_payments`.
- Index recomendado: reusar compostos específicos por tabela: appointments/orders/payments com `status`; avaliar `kuanyin_clients(user_id, status, created_at)` em PR futuro.
- Já existe? parcial: índices por `user_id` ou `(user_id, starts_at/created_at)`; status composto não aparece para todas.
- Risco se não existir: Review Center varre todos os itens do usuário por tabela e filtra status.
- Prioridade: P1.

## 6. Appointments por user_id + starts_at/status

- Arquivo: `src/lib/kuanyin.functions.ts` e `src/lib/kuanyin-review.functions.ts`
- Função: fluxos de proposta/confirmação/listagem/review.
- Query: `kuanyin_appointments.eq(user_id).eq(status).order(starts_at/created_at)` conforme uso operacional.
- Index recomendado: `idx_kuanyin_appointments_user_status_starts on (user_id, status, starts_at)`.
- Já existe? parcial no baseline: `(user_id, starts_at)`.
- Risco se não existir: agenda/review com status pode filtrar fora do índice.
- Prioridade: P1.

## 7. Orders por user_id + created_at/status

- Arquivo: `src/lib/kuanyin.functions.ts` e `src/lib/kuanyin-review.functions.ts`
- Função: fluxos de pedido e Review Center.
- Query: `kuanyin_orders.eq(user_id).eq(status).order(created_at desc)`.
- Index recomendado: `idx_kuanyin_orders_user_status_created on (user_id, status, created_at desc)`.
- Já existe? parcial no baseline: `(user_id, created_at desc)`.
- Risco se não existir: pedidos por status degradam com crescimento comercial.
- Prioridade: P1.

## 8. Payments por user_id + status + created_at

- Arquivo: `src/lib/kuanyin.functions.ts`, `src/lib/kuanyin-public.functions.ts`, `src/lib/kuanyin-review.functions.ts`
- Função: comprovante público, verificação/rejeição, Review Center.
- Query: `kuanyin_payments.eq(user_id).in(status).order(created_at desc)`.
- Index recomendado: `idx_kuanyin_payments_user_status_created on (user_id, status, created_at desc)`.
- Já existe? parcial no baseline: `(user_id, created_at desc)`.
- Risco se não existir: fila de verificação de pagamentos degrada.
- Prioridade: P0.

## 9. Integrity logs por user_id + created_at/category

- Arquivo: `src/lib/kuanyin-integrity.ts` e docs de observabilidade.
- Função: `writeKuanIntegrityLog` e consultas operacionais por `trace_id`/categoria.
- Query: insert por `user_id`; consultas esperadas por `user_id`, `created_at desc`, `category` e eventualmente `metadata/trace_id` em tabelas comerciais.
- Index recomendado: `idx_kuanyin_integrity_logs_user_created on (user_id, created_at desc)`; avaliar `(user_id, category, created_at desc)` após query real.
- Já existe? sim no baseline com nome `kuanyin_integrity_logs_user_idx`.
- Risco se não existir: auditoria e investigação ficam lentas.
- Prioridade: P2.

## Micro-otimizações aplicadas

- `listGuardianInboxThreads` agora limita a inbox a 100 threads ordenadas por `updated_at`.
- `getGuardianInboxThread` agora limita mensagens carregadas a 200 por thread.

## Bloqueios

- SQL real não foi validado porque Supabase CLI não está disponível neste ambiente.
- Status/constraints divergentes (`pending_review`, `pending`, `warning`, `critical`) não foram alterados; exigem inspeção do Supabase comercial real.
