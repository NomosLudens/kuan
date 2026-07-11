# Kuan Commercial Operations (PR 7)

Este documento descreve as diretrizes operacionais estritas para as operações comerciais no Kuan (Clientes, Agendamentos, Pedidos e Pagamentos) executadas no módulo Kuan-Yin.

## Princípios Básicos (Verdade Absoluta)

1. Build passar **NÃO** significa que o app opera.
2. Tela bonita sem dado real é mentira. Operamos via **Supabase**.
3. Dashboard não é operação, utilizamos interface "lista + detalhe + status".
4. Nada sensível muda sem **ação humana**.
5. Kuan-Yin apenas propõe; **o Guardião decide**.

## Ciclo de Vida dos Agendamentos

- **`proposed`**: Proposto pela Kuan-Yin via chat público. O Agendamento não tem validade até que o guardião confirme.
- **`confirmed`**: O Guardião validou a proposta manualmente (`confirmAppointment`).
- **`completed`**: O serviço foi executado. O Guardião dá a baixa (`completeAppointment`).
- **`cancelled`**: O agendamento foi cancelado pelo Guardião (`cancelAppointment`).

## Ciclo de Vida dos Pedidos

- **`draft` / `proposed`**: O pedido foi gerado. Não possui validade oficial.
- **`confirmed`**: O Guardião validou o pedido e confirmou os itens (`confirmOrder`).
- **`delivered`**: O produto foi entregue ao cliente. O Guardião dá a baixa (`deliverOrder`).
- **`cancelled`**: O pedido foi cancelado (`cancelOrder`).

## Ciclo de Vida dos Pagamentos

**IMPORTANTE**: Comprovante recebido **NÃO** é pagamento confirmado automaticamente!

- **`received_proof`**: O cliente/usuário fez o upload de um comprovante.
- **`verified`**: Um Guardião conferiu a conta bancária e verificou que o dinheiro entrou (`verifyPayment`).
- **`rejected`**: O comprovante é falso ou não compensou. É gerado um alerta de fraude (`rejectPayment`).

> **Nota**: Não chamamos o pagamento validado de "confirmed" para evitar confusão de estado. O status em código é sempre `verified` ou `rejected`.
