# Kuan Migration Audit

## Objetivo

Auditar o estado atual de schema/migrations da Kuan-Yin antes da implantação em Supabase comercial próprio.

## Regra

Nenhuma migration destrutiva neste PR.

## Ambiente de auditoria

- Branch: `feat/kuan-migration-debug-optimization`
- HEAD: `ee8967f` (`Merge pull request #12 from Tonyus-dev/codex/close-incorrect-pr-#10-and-implement-pr-8`)
- Remote origin: não
- Branch main local: não
- PR #12 visto no histórico: sim
- Supabase CLI disponível: não
- Validação SQL real executada: não

Ambiente Codex sem origin/main. Base aceita por checkout limpo e histórico contendo merge do PR #12.

## Tabelas Kuan mapeadas

### business_contexts

- Nome: `business_contexts`
- Usada por: `getBusinessContext`, `upsertBusinessContext`, página pública do Guardião, vínculos de appointments/orders/clients/threads.
- Fluxo: contexto comercial real do Guardião: nome, tipo, serviços, preços, voz, agenda, pagamento e observações.
- Campos críticos: `id`, `user_id`, `nome`, `tipo`, `servicos`, `precos`, `tom_voz`, `formas_pagamento`, `pix_chave`, `regras_agenda`, `limites_decisao`, `regras_escalonamento`, `observacoes`, `updated_at`.
- Ownership esperado: sempre por `user_id`; acesso público somente após resolver `kuanyin_guardians.public_slug` publicado e confirmar `business_context_id`.
- RLS esperado: `auth.uid() = user_id` para operações autenticadas; leitura pública direta não deve existir fora de fluxos mediados por server function/service role.
- Indexes necessários: `business_contexts_user_id_idx` já existe no baseline; índice adicional não recomendado agora.
- Riscos: vazamento de dados comerciais se o Supabase real tiver policy anon antiga ou permissiva.

### kuanyin_guardians

- Nome: `kuanyin_guardians`
- Usada por: criação/atualização do perfil público, lookup público por slug, listagem/admin de Guardiões, inbox pública.
- Fluxo: identidade pública do Guardião e ligação entre `business_contexts` e fluxo público.
- Campos críticos: `id`, `user_id`, `admin_user_id`, `business_context_id`, `public_slug`, `status`, `metadata`, `created_at`, `updated_at`.
- Ownership esperado: owner por `user_id`; admin delegado por `admin_user_id` somente nos fluxos que checam explicitamente.
- RLS esperado: owner/admin para Guardião; público deve resolver apenas Guardião `published` via server function.
- Indexes necessários: `public_slug` é unique no baseline; proposal mantém `idx_kuanyin_guardians_public_slug` como SAFE_ADDITIVE somente se o banco comercial não materializar índice equivalente pelo unique.
- Riscos: slug público não pode virar autorização; precisa sempre resolver `guardian_id`, `user_id` e `business_context_id`.

### kuanyin_clients

- Nome: `kuanyin_clients`
- Usada por: criação/listagem/reconhecimento de clientes, pedidos públicos, agendamentos públicos, pagamentos públicos via metadado.
- Fluxo: CRM mínimo real da Kuan-Yin.
- Campos críticos: `id`, `user_id`, `business_context_id`, `linked_user_id`, `nome`, `telefone`, `email`, `preferencias`, `notas`, `status`, `metadata`, `created_at`, `updated_at`.
- Ownership esperado: `user_id`; público só cria/resolve cliente depois de resolver Guardião publicado.
- RLS esperado: `auth.uid() = user_id`; public write mediado por service role com `user_id` do Guardião.
- Indexes necessários: `kuanyin_clients_user_idx`, `kuanyin_clients_business_idx`, `kuanyin_clients_linked_user_idx` já existem; busca por email/telefone pode precisar revisão futura, mas sem proposal agora.
- Riscos: status `pending` aparece no código de review, mas constraint baseline lista `prospect/confirmed/archived`; precisa validação real antes de migration.

### kuanyin_appointments

- Nome: `kuanyin_appointments`
- Usada por: propostas públicas, confirmação/cancelamento/conclusão comercial, Review Center.
- Fluxo: solicitação e gestão de agenda comercial.
- Campos críticos: `id`, `user_id`, `client_id`, `business_context_id`, `service_name`, `starts_at`, `ends_at`, `price_cents`, `status`, `notes`, `evento_id`, `metadata`, `created_at`, `updated_at`.
- Ownership esperado: `user_id`; público insere proposta com `user_id` do Guardião resolvido.
- RLS esperado: `auth.uid() = user_id`; anon não deve ler/escrever diretamente.
- Indexes necessários: existe `(user_id, starts_at)`; proposal recomenda `(user_id, status, starts_at)` para filtros operacionais.
- Riscos: validação SQL real necessária para confirmar cardinalidade e existência de dados/status em produção.

### kuanyin_orders

- Nome: `kuanyin_orders`
- Usada por: pedidos públicos, ciclo de confirmação/entrega, Review Center.
- Fluxo: propostas e pedidos comerciais.
- Campos críticos: `id`, `user_id`, `client_id`, `business_context_id`, `description`, `items`, `price_cents`, `status`, `metadata`, `created_at`, `updated_at`.
- Ownership esperado: `user_id`; público insere proposta com `user_id` do Guardião resolvido.
- RLS esperado: `auth.uid() = user_id` para autenticado; portal público só por token válido se esse fluxo for mantido no Supabase real.
- Indexes necessários: existe `(user_id, created_at desc)`; proposal recomenda `(user_id, status, created_at desc)`.
- Riscos: policies legadas de portal/anon foram endurecidas depois; Supabase real precisa inspeção de grants/policies.

### kuanyin_payments

- Nome: `kuanyin_payments`
- Usada por: comprovante público, verificação/rejeição, Review Center.
- Fluxo: recebimento de comprovante e validação humana; comprovante nunca confirma pagamento.
- Campos críticos: `id`, `user_id`, `order_id`, `appointment_id`, `amount_cents`, `method`, `comprovante_ref`, `status`, `fraud_alert_note`, `metadata`, `created_at`, `updated_at`.
- Ownership esperado: `user_id`; público insere comprovante com `user_id` do Guardião resolvido.
- RLS esperado: `auth.uid() = user_id`; sem confirmação automática pública.
- Indexes necessários: existe `(user_id, created_at desc)`; proposal recomenda `(user_id, status, created_at desc)`.
- Riscos: código consulta `pending_review`, mas constraint baseline lista `received_proof/verified/rejected/pending`; isso é NEEDS_REVIEW/BLOCKED até Supabase real.

### kuanyin_public_chat_threads

- Nome: `kuanyin_public_chat_threads`
- Usada por: chat público, inbox do Guardião, listagem de conversas públicas.
- Fluxo: thread pública por Guardião/visitante.
- Campos críticos: `id`, `guardian_id`, `user_id`, `business_context_id`, `visitor_name`, `visitor_key`, `status`, `created_at`, `updated_at`.
- Ownership esperado: `guardian_id + user_id`; nunca confiar em `threadId` isolado.
- RLS esperado: owner por `user_id`; público mediado por service role após resolver Guardião publicado.
- Indexes necessários: existem índices por guardian/user/visitor; proposal recomenda compostos para lookup público e inbox por status.
- Riscos: `visitor_key` não autentica; deve ser tratado só como continuidade de UX.

### kuanyin_public_chat_messages

- Nome: `kuanyin_public_chat_messages`
- Usada por: chat público, inbox, cap diário de IA.
- Fluxo: mensagens reais visitante/Kuan-Yin por thread.
- Campos críticos: `id`, `thread_id`, `guardian_id`, `user_id`, `role`, `content`, `created_at`.
- Ownership esperado: `guardian_id + user_id + thread_id`.
- RLS esperado: owner por `user_id`; public write/read mediado por server function.
- Indexes necessários: existe `(thread_id, created_at)`; proposal recomenda `(guardian_id, user_id, thread_id, created_at)`.
- Riscos: consulta de cap diário usa `guardian_id + role + created_at`; índice específico pode ser avaliado no futuro, não proposto agora para manter PR mínimo.

### kuanyin_integrity_logs

- Nome: `kuanyin_integrity_logs`
- Usada por: `writeKuanIntegrityLog`, auditoria de respostas/ações comerciais.
- Fluxo: trilha real de integridade comercial.
- Campos críticos: `id`, `user_id`, `thread_id`, `severity`, `category`, `note`, `excerpt`, `created_at`.
- Ownership esperado: `user_id`.
- RLS esperado: owner por `auth.uid() = user_id`; inserts por server functions autenticadas.
- Indexes necessários: `(user_id, created_at desc)` já existe; category pode precisar `(user_id, category, created_at desc)` em PR futuro após query real.
- Riscos: enum de severidade no código usa `warning/critical`, enquanto constraint baseline usa `info/warn/block`; NEEDS_REVIEW porque isso pode quebrar inserts se executado contra schema limpo.

### kuanyin_portal_tokens

- Nome: `kuanyin_portal_tokens`
- Usada por: migrations/policies legadas de portal; uso de código atual não apareceu no escopo `src/lib` auditado.
- Fluxo: leitura pública por token para appointment/order, se mantido.
- Campos críticos: `id`, `user_id`, `scope`, `appointment_id`, `order_id`, `label`, `expires_at`, `revoked_at`, `created_at`, `updated_at`.
- Ownership esperado: `user_id`; token público nunca deve abrir tabela sem checar expiração, revogação e alvo.
- RLS esperado: owner autenticado; anon somente via policy/token estrita se o produto ainda exigir portal.
- Indexes necessários: appointment/order/user já existem.
- Riscos: migrations legadas criaram e depois endureceram anon grants; validar estado real amanhã.

## Tabelas fora do escopo

Não tocar tabelas Kaline/pessoais e de outras facetas: `profiles`, `chat_threads`, `chat_messages`, `eventos`, `workspace_members`, `workspace_invitations`, `livros`, `codice_margens`, `drive_*`, `treino_*`, `jardim_memorias`, `sedimentos`, `contexto_externo`, `registro_vivo`, `reunioes`, `legal_*`, `camara_*`, `kline_*` e demais tabelas não `kuanyin_*` exceto `business_contexts`.

## Migrations existentes

- `supabase/migrations/20260702010000_clean_baseline_v2.sql`: baseline limpo com criação das tabelas Kuan, constraints, índices, triggers e RLS owner-only/workspace para o projeto.
- `supabase/migrations/20260709090000_kline_minimal_ledger.sql`: fora do escopo Kuan.
- `supabase/migrations_legacy/20260625010000_kuanyin_integrity_and_portal_fix.sql`: adiciona FKs, índices e policies de portal anon para Kuan; legado, não aplicar cegamente.
- `supabase/migrations_legacy/20260625013243_6d08beb3-4c37-4b01-b39a-523c0c0a266d.sql`: versão idempotente semelhante do fix de integridade/portal; legado, não aplicar cegamente.
- `supabase/migrations_legacy/20260625033000_kuanyin_portal_anon_hardening.sql`: revoga policies/grants anon de portal; relevante para validar Supabase real.
- `supabase/migrations_legacy/20260626000000_kuanyin_guardians_public_slug.sql`: cria `kuanyin_guardians`, slug público e backfill; contém inserção derivada de dados existentes, não usar como migration nova.
- `supabase/migrations_legacy/20260626001000_kuanyin_guardians_admin_controls.sql`: adiciona controle admin de guardiões; legado.
- `supabase/migrations_legacy/20260626002000_kuanyin_public_chat_threads.sql`: cria threads/mensagens públicas e índices básicos; legado.
- `supabase/migrations_legacy/20260626003000_kuanyin_public_hardening.sql`: endurece grants/policies públicas; relevante para validação real.

## Migrations propostas

- `docs/database/KUAN_INDEX_PROPOSAL.sql`: SAFE_ADDITIVE. Apenas `create index if not exists`; não é migration ativa.
- Índice `idx_kuanyin_guardians_public_slug`: NEEDS_REVIEW, porque unique existente já cria índice equivalente; manter apenas como proposal se banco comercial divergir.
- Índice `idx_kuanyin_public_chat_threads_guardian_user_visitor_updated`: SAFE_ADDITIVE, colunas verificadas no baseline.
- Índice `idx_kuanyin_public_chat_messages_guardian_user_thread_created`: SAFE_ADDITIVE, colunas verificadas no baseline.
- Índice `idx_kuanyin_inbox_user_status_updated`: SAFE_ADDITIVE, colunas verificadas no baseline.
- Índice `idx_kuanyin_appointments_user_status_starts`: SAFE_ADDITIVE, colunas verificadas no baseline.
- Índice `idx_kuanyin_orders_user_status_created`: SAFE_ADDITIVE, colunas verificadas no baseline.
- Índice `idx_kuanyin_payments_user_status_created`: SAFE_ADDITIVE, colunas verificadas no baseline.
- Índice `idx_kuanyin_integrity_logs_user_created`: NEEDS_REVIEW, já existe equivalente com outro nome no baseline.
- Qualquer DROP/RENAME/alteração de constraint de status: REJECTED neste PR.
- Qualquer alteração para corrigir divergência de status/severity sem inspeção do Supabase real: BLOCKED.

## Decisão

Proposal SQL recomendada.

Nenhuma migration real foi criada. A decisão segura é levar apenas proposta aditiva de índices e bloquear alterações de schema/constraint/status até inspeção do Supabase comercial real.
