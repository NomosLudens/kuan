# Kuan — Relatório de Homologação Real

## Ambiente

- commit: HEAD do PR #36 (hash exato no relatório final da IA)
- branch: work
- base do PR observada localmente: 3b690b9
- Supabase: não validado em instância real; CLI `supabase` indisponível neste container
- Cloudflare: não validado; CLI `wrangler` indisponível neste container
- navegador: não executado neste container
- dispositivo: não executado neste container
- data: 2026-07-12

## Cenários

| Cenário                                | Resultado esperado                                           | Resultado real                                                                      | Status |
| -------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------ |
| Migration histórica 20260712002000     | Permanecer compatível com bancos que já aplicaram main       | Restaurada para não carregar o reparo do PR #36                                     | ✅     |
| Migration 20260712003000               | Não falhar quando a RPC ainda não existir em banco novo      | Tornada tolerante via `to_regprocedure`, mantendo hardening quando a função existir | ✅     |
| Migration compensatória 20260712004000 | Reparar banco novo e existente                               | Criada com helpers, policy e RPC atômica                                            | ✅     |
| Server function de supersede           | Chamar apenas RPC e registrar log após sucesso               | `.rpc(...)` usado; retorno vazio agora vira erro                                    | ✅     |
| Dialogs Kuan                           | Sem prompt/confirm nativo nas rotas Kuan alteradas           | Plano, pagamentos e Guardiões usam dialogs do projeto                               | ✅     |
| Banco local `supabase db reset`        | Todas as migrations executam em ordem                        | Não executado: CLI `supabase` ausente                                               | ⚠️     |
| Supabase real                          | RLS/RPC com dois Guardiões reais                             | Não executado: sem credenciais/instância real                                       | ⚠️     |
| Cloudflare `wrangler dev`              | Runtime canônico validado                                    | Não executado: CLI `wrangler` ausente                                               | ⚠️     |
| Fluxo privado em UI                    | Login → plano → chat → decisão → revisão → supersede         | Não executado em navegador real                                                     | ⚠️     |
| Fluxo público em UI                    | `/g/:guardianSlug` → pedido → comprovante → revisão Guardião | Não executado em navegador real                                                     | ⚠️     |
| Mobile 360/390/430                     | Sem overflow e ações acessíveis                              | Não executado em navegador real                                                     | ⚠️     |

## Isolamento

- Guardião A: não criado neste ambiente.
- Guardião B: não criado neste ambiente.
- leitura cruzada: pendente de Supabase real/local com CLI disponível.
- escrita cruzada: pendente de Supabase real/local com CLI disponível.
- RPC cruzada: pendente de Supabase real/local com CLI disponível.
- script previsto: `scripts/qa/pr33-real-isolation.ts`.

## Banco

- db reset: ⚠️ não executado; `supabase` não está instalado no container.
- migrations: ✅ inspeção e testes de contrato automatizados cobrem ordem/reparo textual; execução real pendente.
- RLS: ⚠️ não validada contra banco real nesta execução.
- grants: ✅ reparo SQL inclui revoke/grant para helpers e RPC; validação real pendente.
- RPC: ✅ contrato server/migration validado em teste; execução real pendente.

## Produto

- fluxo privado: ⚠️ não executado em browser real.
- fluxo público: ⚠️ não executado em browser real.
- portal: ⚠️ não executado em browser real.
- pagamentos: ⚠️ inspeção/correção de dialog; fluxo real não executado.
- agenda: ⚠️ não executado em browser real.
- plano: ⚠️ inspeção/correção de dialog e RPC; fluxo real não executado.
- chat: ⚠️ não executado com OpenRouter/Supabase real.

## Mobile

- 360 × 800: ⚠️ não executado.
- 390 × 844: ⚠️ não executado.
- 430 × 932: ⚠️ não executado.

## Incidentes

| Incidente                                             | Causa                                                                             | Correção                                                                                              | Reteste                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Migration histórica alterada no PR #36                | Reparo foi colocado em `20260712002000`, que pode já ter sido aplicada            | Restaurada a migration histórica e movido reparo para `20260712004000_repair_kuan_plan_atomicity.sql` | ✅ testes de contrato; ⚠️ db reset pendente por CLI ausente |
| `20260712003000` podia falhar antes da RPC existir    | Hardening referenciava função ausente em banco novo                               | Bloco condicional com `to_regprocedure` e notice; hardening efetivo fica na 04000                     | ✅ teste de contrato; ⚠️ db reset pendente                  |
| Supersede podia retornar sucesso sem payload validado | Server function lançava erro da RPC mas não validava retorno vazio                | Adicionado erro explícito quando RPC não retorna decisão                                              | ✅ typecheck/test                                           |
| Homologação real bloqueada                            | Sem Supabase real, sem CLI Supabase, sem Wrangler e sem navegador neste container | Documentado como bloqueador externo; sem declarar produto pronto                                      | ⚠️ pendente em ambiente real                                |

## Veredito

❌ Kuan ainda não está homologada.

Bloqueadores mínimos para homologar:

1. Executar `supabase db reset` em ambiente com CLI Supabase e Postgres local.
2. Executar `scripts/qa/pr33-real-isolation.ts` com dois usuários reais sem representar A/B via service_role.
3. Executar fluxos privados e públicos em navegador real.
4. Executar `wrangler dev` com variáveis reais de Cloudflare/Supabase/OpenRouter.
5. Validar mobile em 360, 390 e 430 px.

## Adendo final do PR #36

### Correções

- [x] `getOrCreatePlan` removido do supersede
- [x] limites SQL adicionados
- [x] teste de contrato atualizado
- [x] descrição do PR corrigida via atualização do PR

### Validação

- [ ] `supabase db reset` executado (bloqueado: CLI ausente)
- [ ] RPC encontrada após migrations (bloqueado: CLI/banco ausente)
- [ ] `PUBLIC` sem `EXECUTE` validado em banco (bloqueado: CLI/banco ausente)
- [ ] `anon` sem `EXECUTE` validado em banco (bloqueado: CLI/banco ausente)
- [ ] `authenticated` com `EXECUTE` validado em banco (bloqueado: CLI/banco ausente)
- [ ] Guardião A substitui decisão própria em banco real
- [ ] Guardião B não altera decisão A em banco real
- [ ] concorrência não cria órfã em banco real

Observação: os itens de banco real permanecem desmarcados porque a CLI Supabase e o ambiente real não estão disponíveis neste container.

### Smoke local

- [x] `bun run start` iniciou servidor local em `http://0.0.0.0:3000`
- [x] `curl -I http://127.0.0.1:3000/` retornou `200 OK`
- [x] `curl -I http://127.0.0.1:3000/kuan` retornou `200 OK`
- [x] `curl -I http://127.0.0.1:3000/kuan/plano` retornou `200 OK`

### Checks automatizados no novo head

- [ ] `bun run format:check` — falhou em dois arquivos legados fora do diff do PR
- [x] `bun run lint`
- [x] `bun run typecheck`
- [x] `bun run test`
- [x] `bun run build`
- [x] `git diff --check`

## GitHub Actions permanente

O workflow `.github/workflows/ci.yml` agora possui job `database` com Supabase local descartável para validar, em CI remoto:

- migrations do zero com `supabase db reset`;
- fixtures locais de dois Guardiões;
- RLS entre Guardião A e Guardião B via `scripts/qa/pr33-real-isolation.ts`;
- grants da RPC contra `anon` e `authenticated`;
- RPC `kuanyin_supersede_plan_decision` para decisão própria;
- bloqueio de tentativa cross-tenant de B contra decisão A;
- concorrência com duas chamadas simultâneas;
- ausência de decisão órfã/duplicada;
- normalização de `title`, `decision_text`, `context`, `rationale` e `consequences`.

Status local: o job foi adicionado, mas a execução remota do GitHub Actions ainda precisa ficar verde antes de marcar a validação permanente como aprovada.
