# Kuan-Yin Security & Integrity

## Princípios de Segurança (Modo PonyTail)
1. **Frontend Desdentado:** O cliente NUNCA tem autoridade. Nenhum ID que vem do payload é usado como prova de propriedade sem verificar o `user_id` de quem faz a requisição.
2. **Service Role Isolado:** A chave `SUPABASE_SERVICE_ROLE_KEY` e a instância `supabaseAdmin` são estritamente backend-only. Qualquer vazamento para o frontend é considerado incidente crítico.
3. **Whitelist por Padrão:** Não existem "páginas públicas" por tabela. Para a Kuan-Yin de um guardião ser acessada via `/g/:guardianSlug`, o registro deve estar explicitamente marcado com `status = 'published'` no banco de dados. Um slug aleatório ou não publicado responde como 404/not_found.
4. **Log Best-Effort:** Ações comerciais (agendamento, pagamento, aprovação de pedido) devem registrar uma trilha de integridade, mas a falha em gravar o log não pode derrubar a transação (fallback grace). O helper `writeKuanIntegrityLog` captura os erros com `console.warn` e não propaga a falha.
5. **Rate Limiting:** Todas as interações públicas sofrem *rate limiting* por originador e limite diário rígido no banco de dados, protegendo os custos do modelo LLM.

## Trilha de Auditoria Comercial (Integrity Logs)
O PR 8 adicionou logs atômicos atrelados a todos os métodos de escrita de `kuanyin.functions.ts` e `kuanyin-inbox.functions.ts`:
- **Agendamentos:** Confirmação, Cancelamento e Conclusão.
- **Pedidos:** Confirmação, Cancelamento e Entrega.
- **Pagamentos:** Verificação e Rejeição.
- **Inbox:** Envio de mensagem manual e alteração de status do atendimento.

> **Importante:**
> Os logs de integridade NÃO salvam chaves PII diretas (como o nome inteiro ou e-mail), apenas o `user_id` de quem operou, o tipo de evento, e referências de ID (ex: `order_id`).
