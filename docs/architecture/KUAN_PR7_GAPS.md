# Lacunas das Operações Comerciais (Kuan PR 7)

Apesar de as telas de operações (Clientes, Agendamentos, Pedidos, Pagamentos) estarem funcionais e ligadas diretamente ao banco de dados Supabase, o fluxo **NÃO** está 100% completo, pois ainda possui algumas lacunas de integração fundamentais. 

Estas lacunas foram intencionalmente mantidas neste PR para evitar escopo excessivo ("feature creep") e respeitar o Modo PonyTail.

## 1. Falta de Integração com Google Calendar
- **Problema:** Quando um agendamento transita para `confirmed`, o Guardian precisa ter certeza de que o calendário o reflete, mas atualmente não existe integração forte bidirecional com o Google Calendar.
- **Impacto:** O Guardian pode acidentalmente sobrepor horários.

## 2. Falta de Validação Bancária Automática (Pagamentos)
- **Problema:** O fluxo de Pagamentos exige que o Guardião olhe manualmente para o extrato bancário para então clicar no botão "Verificar". **Não há validação bancária**.
- **Impacto:** Há dependência 100% manual e margem de erro ou demora se houver volume.

## 3. Falta de Histórico Estruturado de Transição
- **Problema:** Ao mudar o status (ex: de `proposed` para `confirmed`, ou de `confirmed` para `completed`), não há registro imutável do evento diretamente na tabela. (Pode depender do log geral se não usar `integrity_logs`).
- **Impacto:** Se houver disputa ("Você disse que foi entregue, mas eu não recebi!"), o rastreio fica prejudicado.

## 4. Falta de Integrações Externas / Nota Fiscal
- **Problema:** Ao marcar um pedido como `delivered` ou pagamento como `verified`, nenhuma NF-e é emitida, e não há integração com sistemas logísticos ou ERP.

## 5. Falta de Múltiplos Atendentes / Concorrência
- **Problema:** Não existe lógica forte de lock (um atendente bloqueando o ticket enquanto analisa). 
- **Impacto:** Dois Guardiões podem acabar operando o mesmo pedido / comprovante ao mesmo tempo.
