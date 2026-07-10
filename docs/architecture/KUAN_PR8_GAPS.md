# Gaps and Follow-ups for PR 8

O PR 8 "Security, Integrity & Commercial Supabase Readiness" implementou as salvaguardas de auditoria (logs) e conferiu a segurança (service role isolation, public page whitelisting, atomic operations) do sistema, mas aderindo ao modo *PonyTail* (cirúrgico e focado), algumas implementações ficaram para PRs futuros:

## Gaps

1. **Migração do Banco de Dados / Instância Prod**
   - O PR 8 prepara a aplicação, mas a criação física de um novo banco no Supabase e a alteração de `.env` será um evento à parte, com plano de backup e rollback. Não foram feitas alterações no ambiente atual durante este PR.

2. **Rate Limit com Redis (Em Memória Persistente)**
   - Atualmente, o Rate Limit da aplicação usa contadores em memória local (Node.js) ou na tabela persistida (para o teto diário de IA). Não adicionamos Redis nem banco em memória para evitar complexidade e custos infraestruturais neste estágio. A proteção com a tabela do cap diário atende a necessidade de evitar o sangramento de créditos LLM.

3. **Dashboard / Reports Analíticos**
   - Os logs de integridade em `kuanyin_integrity_logs` estão operando perfeitamente e gravando no Supabase. No entanto, o frontend ainda não consome esses logs para mostrar relatórios/dashboard ao usuário final. Uma nova rota/dashboard deve ser pensada para Guardiões consultarem seu registro de auditoria, se desejado.

4. **Auditoria de Tabelas Supabase RLS Externa**
   - Nós não tocamos nas `supabase/migrations/` neste PR. Presumimos que as regras já em vigor estão sólidas, já que as requisições respeitam `user_id` de quem dispara a query. Recomendado revisar as definições de RLS da instância nativa do Supabase antes do Go-Live Comercial, usando a skill de Firebase/Supabase Security Rules Auditor.
