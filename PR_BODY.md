# PR 5 — Guardian Inbox + Manual Reply (Correções)

## Summary

Este Pull Request implementa a visualização e resposta manual de conversas públicas do Guardian, respeitando o limite do Modo Ponytail. Foi adicionada validação com `zod`, e as restrições de estado da thread ("open", "closed") são rigorosamente impostas, tanto no front quanto no backend.

## Product Rules

1. A resposta manual não confirma agendamento ou pagamento.
2. O Guardian não pode enviar respostas em threads que estejam fechadas (`closed`). Ele deve explicitamente reabrir o atendimento.
3. Todas as operações de leitura e gravação garantem pertencimento checando o `user_id`.
4. As mensagens manuais possuem tamanho máximo de 3000 caracteres.
5. Não foram criados dashboards, integrações externas ou relatórios analíticos.

## Testing

- `bun run typecheck`
- `bun run test`
- `bun run build`
- `git diff --check`
  (Testes automatizados locais passaram).

- Teste Manual na Rota: Verificada a interface de bloqueio de mensagens se status for `closed`.

## Lacunas Conhecidas (Gaps)

- A resposta manual da interface do Guardian usa o mesmo `role` (`"kuanyin"`) que as respostas automatizadas. Isso ocorre porque o schema atual da tabela `kuanyin_public_chat_messages` não suporta uma coluna de metadados explícita para registrar a "origem" (fonte humana vs IA), e optou-se por não criar uma migration nova nesta iteração de PR a pedido dos requisitos do projeto.
- Não existem notificações (push/email) para novos atendimentos.
- A visualização é limitada à cronologia da thread, não permitindo filtros avançados além de abertos/fechados/todos.
