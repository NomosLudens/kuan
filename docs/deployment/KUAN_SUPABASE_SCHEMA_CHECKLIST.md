# Kuan Supabase Schema Checklist

## Tabelas obrigatórias

- [ ] business_contexts
- [ ] kuanyin_guardians
- [ ] kuanyin_clients
- [ ] kuanyin_appointments
- [ ] kuanyin_orders
- [ ] kuanyin_payments
- [ ] kuanyin_public_chat_threads
- [ ] kuanyin_public_chat_messages
- [ ] kuanyin_integrity_logs
- [ ] kuanyin_portal_tokens, se ainda usado

## Constraints críticas

Validar e registrar valor real aceito:

### kuanyin_payments.status

Esperado pelo código atual:

- received_proof
- verified
- rejected
- pending_review

Possível baseline legado:

- received_proof
- verified
- rejected
- pending

Resultado real:

- [ ] pending_review aceito
- [ ] pending aceito
- [ ] divergência encontrada

### kuanyin_integrity_logs.severity

Esperado pelo código atual:

- info
- warning
- critical

Possível baseline legado:

- info
- warn
- block

Resultado real:

- [ ] warning/critical aceitos
- [ ] warn/block aceitos
- [ ] divergência encontrada

## RLS / policies

Validar:

- [ ] Guardião lê apenas seus dados.
- [ ] Outro usuário não lê inbox do Guardião.
- [ ] Outro usuário não altera pedido/agendamento/pagamento.
- [ ] Cliente sem login não acessa painel.
- [ ] Página pública lê apenas whitelist pública.
- [ ] Portal tokens legados não expõem dados indevidos.

## Índices

Consultar ou documentar ausência de consulta real:

- [ ] kuanyin_guardians(public_slug)
- [ ] kuanyin_public_chat_threads(guardian_id, user_id, visitor_key, updated_at)
- [ ] kuanyin_public_chat_messages(guardian_id, user_id, thread_id, created_at)
- [ ] kuanyin_public_chat_threads(user_id, status, updated_at)
- [ ] kuanyin_appointments(user_id, status, starts_at)
- [ ] kuanyin_orders(user_id, status, created_at)
- [ ] kuanyin_payments(user_id, status, created_at)
- [ ] kuanyin_integrity_logs(user_id, created_at)

## Decisão

- [ ] Schema pronto.
- [ ] Schema pronto com ressalvas.
- [ ] Schema precisa PR 11.
- [ ] Schema bloqueado.
