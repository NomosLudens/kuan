# Supabase Commercial Readiness (PR 8)

O projeto Kuan chegou a um nível de maturidade em que um único banco de dados de staging não deve mais conter dados comerciais de produção reais, por motivos óbvios de escalabilidade, compliance e segurança (Isolamento). 

## Objetivo
Preparar o terreno para a migração para a **Instância de Produção Oficial do Supabase**. O PR 8 prepara a arquitetura sem de fato mexer na URL/Key do Supabase agora (isto será feito num deploy/migração dedicada).

## Prontidão
- **RLS (Row Level Security):** O app opera perfeitamente com policies que travam as linhas ao `user_id`.
- **Validação:** Zod valida os inputs rigorosamente antes de bater no banco.
- **Trilha de Auditoria:** Qualquer mudança de status comercial sensível (como aprovar, rejeitar, concluir agendamentos/pedidos) registra log de integridade (`kuanyin_integrity_logs`), provendo non-repudiation na camada da aplicação.
- **Service Role Controlado:** `SUPABASE_SERVICE_ROLE_KEY` e a instância `supabaseAdmin` são protegidos em arquivos `*.server.ts` e não vazam no cliente.
- **Rate Limit de Proteção a Custos:** A tabela de mensagens e a verificação do cap diário impedem que a IA drene recursos em ataques massivos, independente se em staging ou prod.

## Próximos Passos (Estratégia de Transição)
O próximo passo no ciclo de vida (fora do escopo do PR 8) será:
1. Criar o Projeto Produção na plataforma Supabase.
2. Rodar as migrations da pasta `supabase/migrations`.
3. (Opcional) Migrar Guardiões seletos em soft-launch se houver demanda.
4. Trocar as variáveis `.env` na Vercel de Prod para apontarem pro novo projeto.
5. Iniciar operações comerciais da plataforma.
