# Kuan Security & Integrity

## Objetivo

Endurecer Kuan-Yin para operação comercial assistida.

## Áreas auditadas

* service role
* ownership
* public whitelist
* integrity logs
* input validation
* abuse control
* Supabase comercial

## Regras duras

* Cliente público não acessa dados administrativos.
* Guardião só acessa dados próprios.
* Service role apenas server/backend.
* Rota pública retorna whitelist.
* Logs de integridade são best-effort.
* Rate limit fake é proibido.
* Sem migration neste PR.

## Service role

Auditoria executada com:

```sh
rg -n "supabaseAdmin|service_role|SERVICE_ROLE|SUPABASE_SERVICE|client.server|createClient" src
```

Resultado: `SUPABASE_SERVICE_ROLE_KEY` é lida em `src/integrations/supabase/client.server.ts` e `supabaseAdmin` é usado por server functions/rotas server-side. Não foi encontrado `VITE_*` contendo service role, nem uso direto de service role em cliente browser. Imports de `client.server` permanecem dinâmicos dentro de handlers server-side.

## Public whitelist

A página pública `/g/:guardianSlug` deve expor apenas:

* `slug`
* `name`
* `type`
* `tone`
* `services`
* `prices`
* `paymentMethods`
* `scheduleRules`
* `notes`
* `canonicalPath`

A página pública não deve expor:

* `user_id`
* `admin_user_id`
* `business_context_id`
* `guardian_id` interno
* `status` interno
* `updated_at` interno
* `pix_chave`
* tokens
* clientes
* pagamentos
* pedidos privados
* comprovantes
* threads de outros visitantes

Auditoria: `pix_chave` não é retornada no payload público e também é removida do contexto passado ao chat público.

## Ações logadas

Logs de integridade best-effort foram adicionados para:

* confirmação, cancelamento e conclusão de agendamentos;
* confirmação, cancelamento e entrega de pedidos;
* verificação e rejeição de pagamentos;
* resposta manual do Guardião na inbox;
* alteração de status de thread pública;
* resolução de itens de revisão.

Os logs registram categoria, nota e IDs técnicos mínimos em `excerpt`; não registram payload bruto, mensagem completa, telefone, email, chave Pix, comprovante completo ou dados bancários.

## Lacunas

Ver [`KUAN_PR8_GAPS.md`](./KUAN_PR8_GAPS.md).
