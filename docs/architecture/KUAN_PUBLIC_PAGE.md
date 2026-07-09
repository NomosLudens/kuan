# Kuan Public Guardian Page

## Objetivo

A página /g/:guardianSlug é a superfície pública do Guardião para clientes sem login.

Ela lê o Guardião publicado pelo `public_slug` e mostra somente uma seleção pública do contexto real salvo no Supabase existente.

## Dados públicos permitidos

- nome do negócio;
- tipo/descrição do negócio;
- tom de voz quando for apropriado para comunicação pública;
- serviços publicados;
- preços ou faixas de preço publicados;
- formas de pagamento publicadas;
- regras básicas de agenda publicadas;
- observações públicas do negócio;
- caminho canônico `/g/:guardianSlug`.

## Dados proibidos

- user_id;
- tokens;
- clientes;
- pagamentos privados;
- logs;
- regras internas sensíveis;
- limites de decisão brutos;
- regras de escalonamento brutas;
- qualquer dado administrativo.

## Regras duras

- Cliente sem login só lê dados públicos.
- Pedido de agendamento não é agendamento confirmado.
- Comprovante recebido não é pagamento confirmado.
- Guardião confirma ação sensível.
- Sem mock.
- Sem dashboard falso.

## Lacunas conhecidas

Nenhuma lacuna conhecida neste PR.
