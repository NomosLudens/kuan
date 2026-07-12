# QA manual — PR33 Kuan Central Estratégica

> Deve ser executado com Supabase real antes de aprovar produto. Build verde não substitui estes cenários.

## Base

- Base SHA local registrado no PR.
- Branch: `codex/pr33-kuan-central-estrategica`.

## Cenários

1. Estado vazio: login como Guardião → `/kuan/plano` → contexto existe e plano não → empty real, sem dados demo.
2. Criar plano: “Criar plano básico” → confirmar → row em `kuanyin_business_plans` → reload preserva.
3. Direção via chat: `/kuan` → pedir priorização → action card → antes do clique nada muda → confirmar → direção aparece em `/kuan/plano`.
4. Decisão: Kuan propõe decisão → confirmar cartão → row `proposed` → chat não trata como aceita → aceitar em `/kuan/plano` com confirmação → `accepted_at` e `accepted_by` preenchidos.
5. Substituição: decisão aceita → substituir → nova decisão criada → antiga `superseded` preservada.
6. Marco: decisão aceita → transformar em marco → milestone `planned` ligado à decisão → nenhuma row em `kuanyin_appointments`.
7. Cliente relacionado: vincular cliente existente → aparece em Clientes → remover vínculo → cadastro permanece intacto.
8. Ciclo e revisão: ativar mensal → definir próxima data → iniciar revisão → facts reais → concluir → `last_review_at` atualizado.
9. Erro real: forçar erro de leitura → UI mostra erro, não empty e não “Tudo pronto”.
10. Isolamento: Guardião A cria plano/decisão; Guardião B tenta consultar IDs de A → zero dados/forbidden.
11. Mobile: validar 360px, 390px e 430px sem overflow; botões confortáveis; timeline vertical; coach abre `/kuan?seed=...`.

## Rollback preferencial

- Esconder entrada `/kuan/plano` no `APP_REGISTRY` e remover CTA do cabeçalho sem apagar tabelas.
- Desabilitar os três action types removendo-os do schema para o chat seguir comercial sem cartões de plano.
- Remover a concatenação de `planContextBlock` em `src/routes/api/chat.ts` para preservar chat sem contexto estratégico.
- Não apagar tabelas automaticamente após deploy: elas guardam decisões e histórico operacional recuperável.

## Validação final pré-merge

> Status em 2026-07-12: QA real com Supabase de produção/staging não executado neste ambiente porque não há credenciais reais de dois Guardiões nem projeto Supabase autenticável configurado. Não substituir esta etapa por build verde.

### Script reproduzível de isolamento A/B

Executar com duas contas reais de Guardião e IDs reais já existentes:

```bash
SUPABASE_URL="https://..." \
SUPABASE_ANON_KEY="..." \
PR33_USER_A_EMAIL="guardiao-a@example.com" \
PR33_USER_A_PASSWORD="..." \
PR33_USER_B_EMAIL="guardiao-b@example.com" \
PR33_USER_B_PASSWORD="..." \
PR33_PLAN_A_ID="..." \
PR33_PLAN_B_ID="..." \
PR33_DECISION_A_ID="..." \
bun scripts/qa/pr33-real-isolation.ts
```

O script usa apenas clientes autenticados com `SUPABASE_ANON_KEY` + sessão dos usuários A/B. Não usar `service_role` para simular usuário final.

### Segurança

- [ ] RPC sem EXECUTE para PUBLIC — validar no Supabase real após migrations.
- [ ] RPC sem EXECUTE para anon — validar no Supabase real após migrations.
- [ ] authenticated consegue chamar apenas dentro do próprio plano — validar com o script A/B.
- [ ] Guardião B não acessa dados do Guardião A — validar com o script A/B.

### Fluxo real

- [ ] Chat gerou proposta — registrar ID da mensagem/cartão sem dados sensíveis.
- [ ] Nada persistiu antes da confirmação — registrar contagem antes/depois nas tabelas de plano.
- [ ] Decisão nasceu `proposed` — registrar ID da decisão.
- [ ] Aceite preencheu `accepted_by`/`accepted_at` — registrar estado antes/depois.
- [ ] Marco nasceu `planned` — registrar ID do marco.
- [ ] Substituição preservou histórico — registrar ID antigo `superseded` e ID novo.
- [ ] Chat passou a usar a nova decisão aceita — registrar evidência sem conteúdo sensível.
- [ ] Decisão `superseded` deixou de orientar — registrar evidência do bloco de contexto.

### Interface

- [ ] loading real.
- [ ] error real.
- [ ] empty real.
- [ ] mobile 360/390/430.

### Tabelas e relações a validar com RLS real

Para cada tabela abaixo, verificar dono, outro Guardião e `anon`: `kuanyin_business_plans`, `kuanyin_plan_decisions`, `kuanyin_plan_milestones`, `kuanyin_plan_review_cycles`, `kuanyin_plan_reviews`, `kuanyin_plan_links`.

Também validar cruzamento indevido dos campos `guardian_id`, `business_context_id`, `plan_id`, `decision_id`, `cycle_id`, `review_id` e `milestone_id`.
