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
