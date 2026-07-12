# Kuan — Relatório de Homologação Real

Data: 2026-07-12
Branch: atual do repositório local

## Cenário

Homologação de fechamento do produto Kuan após reparo pós-merge, com foco em consistência entre banco, migrations, server functions, RLS, chat e plano estratégico.

## Resultado

❌ Produto ainda não homologado em ambiente real.

A base recebeu correções críticas de consistência para o plano estratégico, porém a homologação real completa depende de credenciais e instâncias externas de Supabase real, Cloudflare local com variáveis de produção e provedores de pagamento/OpenRouter que não estão disponíveis neste ambiente não interativo.

## Falhas encontradas

1. A server function de substituição de decisão ainda fazia `insert` seguido de `update` e `delete` compensatório manual em caso de erro, violando o fluxo atômico exigido para supersede.
2. A migration de hardening de privilégios referenciava a RPC `public.kuanyin_supersede_plan_decision`, mas a migration de criação do plano não definia essa função antes do `REVOKE`/`GRANT` posterior.
3. A policy de `kuanyin_business_plans` repetia a lógica de ownership inline em vez de usar helper SQL explícito para Guardião, business_context e `auth.uid()`.
4. A tela do plano usava `window.prompt` e `window.confirm` para substituição de decisão, vínculo de cliente, remoção de vínculo e conclusão de revisão.

## Correções aplicadas

1. Criada a RPC transacional `public.kuanyin_supersede_plan_decision` como `SECURITY INVOKER`, com lock `FOR UPDATE`, criação da nova decisão e atualização da decisão antiga dentro da própria transação do PostgreSQL.
2. A server function `supersedeKuanPlanDecision` agora autentica, resolve o Guardião/plano, chama apenas a RPC e registra log de integridade.
3. Adicionado helper SQL explícito `public.kuanyin_can_own_plan(guardian_id, business_context_id)` e reutilizado por `public.kuanyin_plan_owned(plan_id)` e pela policy de business plans.
4. Substituídos prompts/confirms da central de plano por dialogs existentes baseados em `AlertDialog`, `Input`, `Textarea` e `Button` do projeto.

## IDs anonimizados

Nenhum ID real foi coletado neste ambiente. A homologação real com Guardião A, Guardião B, clientes, negócios, pedidos e pagamentos permanece pendente por ausência de ambiente externo configurado.

## QA executado neste ambiente

| Área                             | Status | Observação                                                            |
| -------------------------------- | ------ | --------------------------------------------------------------------- |
| Contrato SQL da RPC de supersede | ✅     | Teste automatizado passou.                                            |
| TypeScript                       | ✅     | `tsc --noEmit` passou.                                                |
| Supabase real                    | ⚠️     | Não executado por ausência de credenciais/instância real no ambiente. |
| Cloudflare local                 | ⚠️     | Não executado por ausência de configuração runtime completa.          |
| Fluxo privado manual             | ⚠️     | Não executado contra backend real.                                    |
| Fluxo público manual             | ⚠️     | Não executado contra backend real.                                    |
| Mobile 360/390/430               | ⚠️     | Não validado por ausência de app rodando com backend real.            |

## Pendências

1. Executar migrations em banco Supabase vazio real.
2. Criar Guardião A e Guardião B em instância real e validar isolamento completo de RLS.
3. Executar fluxo privado completo: login, configuração, plano, chat, proposta, aceite, marco, revisão, substituição e histórico.
4. Executar fluxo público completo: página pública, conversa, prospect, pedido, pagamento, comprovante, confirmação manual pelo Guardião e mudança de status.
5. Validar rotas smoke em Cloudflare local com env real: `/`, `/kuan`, `/kuan/plano`, `/kuan/clientes`, `/kuan/agendamentos`, `/g/:guardian`, `/portal/:token`, `/convite`.
6. Validar mobile em 360, 390 e 430px com backend real.

## Veredito

❌ Produto ainda não homologado.
