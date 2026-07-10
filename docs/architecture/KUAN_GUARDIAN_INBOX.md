# Kuan Guardian Inbox

## Objetivo

Permitir que o Guardião logado leia e responda conversas públicas recebidas em `/g/$guardianId`.

## Tabelas usadas

- `kuanyin_public_chat_threads`
- `kuanyin_public_chat_messages`

## Escopo

- listar conversas filtradas por `open`, `closed` e `all`;
- abrir conversa e visualizar o histórico de mensagens;
- responder manualmente pelo painel logado;
- marcar como resolvida (`closed`);
- reabrir conversa (`open`).

## Regras duras

- **Autenticação obrigatória:** Cliente sem login não acessa o inbox.
- **Isolamento de dados:** A thread é sempre filtrada por `user_id`. Nunca se confia apenas no `threadId` recebido do frontend.
- **Responsabilidade manual limitada:** Resposta manual não confirma pagamento e não confirma agendamento. Tais aprovações dependem dos trâmites transacionais da Kuan-Yin.
- **Modo Ponytail:** Sem dashboard, sem analytics, sem métricas vaidosas e sem integração externa.

## Estados

- `open`: A conversa está ativa.
- `closed`: A conversa foi marcada como resolvida pelo Guardião.
