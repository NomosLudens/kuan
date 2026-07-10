# Kuan RLS Ownership Audit

## Contrato

Operações autenticadas devem escopar por:

- `user_id`

Operações públicas devem resolver e respeitar:

- `guardian_id`
- `user_id` do Guardião
- `business_context_id`

Nunca confiar apenas em:

- `id` vindo do client
- `threadId`
- `visitorKey`
- `slug`
- `business_context_id` público

Há policies SQL no repositório, principalmente no baseline limpo. Mesmo assim, RLS real precisa ser validada amanhã no Supabase comercial porque migrations legadas tiveram grants/policies anon de portal e hardening posterior.

## business_contexts

- leitura Guardião: autenticado por `user_id`; admin/workspace não deve acessar se policy real não permitir explicitamente.
- escrita Guardião: `upsertBusinessContext` grava `user_id` autenticado.
- escrita pública: proibida; público só lê dados selecionados via server function depois de resolver Guardião publicado.
- risco: policy anon legada em Supabase real pode expor contexto comercial.
- recomendação: validar `business_contexts_own_rows`, grants anon e ausência de SELECT anon amplo no Supabase comercial.

## kuanyin_guardians

- leitura Guardião: owner/admin após checagem de `user_id`/`admin_user_id`; listagem usa service role e filtra explicitamente.
- escrita Guardião: owner/admin; updates devem checar `id` + owner/admin.
- escrita pública: proibida.
- risco: `public_slug` é identificador público, não autorização.
- recomendação: manter lookup público somente por server function e exigir `status = published` antes de expor contexto.

## kuanyin_clients

- leitura Guardião: `user_id`.
- escrita Guardião: `user_id` autenticado em create/update/list.
- escrita pública: permitida somente via service role após resolver `guardian_id`, `user_id`, `business_context_id`; insere `status = prospect`.
- risco: dados pessoais de cliente; não abrir anon direto.
- recomendação: validar RLS owner-only e revisar divergência `pending` vs `prospect` antes de qualquer migration.

## kuanyin_appointments

- leitura Guardião: `user_id`.
- escrita Guardião: `user_id` em propostas/confirmações/cancelamentos/conclusões.
- escrita pública: cria proposta com `user_id` e `business_context_id` resolvidos do Guardião publicado.
- risco: agendamento não pode ser confirmado automaticamente por fluxo público.
- recomendação: manter status público como `proposed`; validar ausência de anon write direto.

## kuanyin_orders

- leitura Guardião: `user_id`.
- escrita Guardião: `user_id` em proposta/confirmação/cancelamento/entrega.
- escrita pública: cria pedido `proposed` com ownership resolvido.
- risco: portal anon legado pode vazar pedido se token policy real estiver incorreta.
- recomendação: validar grants/policies anon de `kuanyin_orders` no Supabase comercial.

## kuanyin_payments

- leitura Guardião: `user_id`.
- escrita Guardião: verificação/rejeição por `user_id`.
- escrita pública: só cria comprovante `received_proof`; não confirma pagamento.
- risco: constraint/status divergente (`pending_review` no código; `pending` no baseline) e risco de UX/consulta esconder pagamentos.
- recomendação: bloquear alteração de constraint até inspeção; validar RLS owner-only e logs reais.

## kuanyin_public_chat_threads

- leitura Guardião: `user_id` e, em alguns fluxos admin, conjunto de `guardian_id` autorizado.
- escrita Guardião: status/resposta exige `user_id` + `threadId`.
- escrita pública: resolve ou cria thread após lookup de Guardião publicado; update deve incluir `id + guardian_id + user_id`.
- risco: `threadId` e `visitorKey` não autenticam visitante.
- recomendação: toda leitura pública de thread deve combinar `guardian_id + user_id + thread_id` ou `guardian_id + user_id + visitor_key`.

## kuanyin_public_chat_messages

- leitura Guardião: `user_id + thread_id`; idealmente também `guardian_id` quando disponível.
- escrita Guardião: resposta manual insere via service role após thread owner check.
- escrita pública: insere visitor/kuanyin depois de thread resolvida por `guardian_id + user_id`.
- risco: mensagens cruzadas se consulta confiar apenas em `thread_id`.
- recomendação: manter queries públicas com `guardian_id + user_id + thread_id`; limitar listagens operacionais.

## kuanyin_integrity_logs

- leitura Guardião: `user_id`.
- escrita Guardião: server functions autenticadas com `user_id`.
- escrita pública: somente se uma server function pública registrar evento com `user_id` resolvido; hoje logs principais usam camada autenticada.
- risco: constraint de severity pode quebrar inserts de `warning/critical`.
- recomendação: validar schema real e alinhar enum/código em PR futuro, sem migration cega.

## kuanyin_portal_tokens

- leitura Guardião: `user_id`.
- escrita Guardião: emissão/revogação deve ser owner-only.
- escrita pública: proibida.
- risco: tokens públicos antigos/policies anon legadas podem expor appointments/orders/business_contexts.
- recomendação: inspecionar policies reais `portal_token_anon_read`, `appointment_anon_read_via_token`, `order_anon_read_via_token`, `business_context_anon_read_via_token`; confirmar hardening efetivo.

## Validação pendente

Supabase CLI não disponível neste ambiente. Validação SQL real fica para PR 10.
