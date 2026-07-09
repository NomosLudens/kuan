# Kuan Public Chat

## Objetivo

Permitir que clientes sem login conversem com a Kuan-Yin do Guardião pela página pública /g/:guardianSlug.

## Públicos

- Guardião logado: usa /kuan.
- Cliente sem login: usa /g/:guardianSlug.

## Persistência

O chat público usa as tabelas reais existentes do Supabase:

- `kuanyin_public_chat_threads`: armazena a conversa pública, associada a `guardian_id`, `business_context_id`, `user_id` do Guardião, `visitor_key`, `visitor_name`, `status`, `created_at` e `updated_at`.
- `kuanyin_public_chat_messages`: armazena mensagens reais por `thread_id`, `guardian_id`, `user_id`, `role`, `content` e `created_at`.

A página pública resolve o Guardião por `public_slug`, cria ou reutiliza uma thread pública por `visitor_key` local do navegador e persiste a mensagem do cliente e a resposta da Kuan-Yin antes de exibir o histórico atualizado.

## Dados públicos permitidos

A resposta pública usa somente campos comerciais liberados do Guardião/contexto de negócio:

- `kuanyin_guardians.id` como vínculo interno de persistência, sem retorno ao cliente como dado administrativo sensível.
- `kuanyin_guardians.public_slug`.
- `kuanyin_guardians.status` para aceitar somente Guardiões publicados.
- `business_contexts.id` como vínculo interno de persistência.
- `business_contexts.nome`.
- `business_contexts.tipo`.
- `business_contexts.tom_voz`.
- `business_contexts.servicos`.
- `business_contexts.precos`.
- `business_contexts.formas_pagamento`.
- `business_contexts.pix_chave` quando já publicado no contexto comercial.
- `business_contexts.regras_agenda`.
- `business_contexts.observacoes`.
- `business_contexts.updated_at`.

## Dados proibidos

- `user_id`.
- tokens.
- logs.
- clientes privados.
- pagamentos privados.
- dados administrativos.
- regras internas sensíveis.

## Regras duras

- Cliente não executa ação administrativa.
- Pedido de agendamento não é agendamento confirmado.
- Comprovante informado não é pagamento confirmado.
- Guardião confirma ação sensível.
- Sem mock.
- Sem resposta fake.

## Lacunas conhecidas

Nenhuma lacuna conhecida neste PR.
