# Kuan Smoke Test

## Objetivo

Validar que o ambiente real/staging responde sem mock.

## Pré-condições

- Supabase configurado.
- OpenRouter configurado.
- App buildado.
- Ambiente rodando.

## Testes

### Backend/env

- [ ] SUPABASE_URL presente.
- [ ] SUPABASE_SERVICE_ROLE_KEY presente no backend.
- [ ] OPENROUTER_API_KEY presente no backend.
- [ ] Nenhum segredo aparece no client bundle.

### Rotas

- [ ] /kuan-yin abre logado.
- [ ] /kuan-yin/config abre logado.
- [ ] /kuan-yin/inbox abre logado.
- [ ] /kuan-yin/revisao abre logado.
- [ ] /kuan-yin/agendamentos abre logado.
- [ ] /kuan-yin/pedidos abre logado.
- [ ] /kuan-yin/pagamentos abre logado.
- [ ] /g/:slug abre sem login.

### Banco

- [ ] business_contexts grava.
- [ ] kuanyin_guardians publica slug.
- [ ] página pública lê whitelist.
- [ ] chat público grava thread.
- [ ] chat público grava mensagem.
- [ ] inbox lista thread.
- [ ] resposta manual grava mensagem.
- [ ] integrity log não quebra fluxo.

### OpenRouter

- [ ] Chamada real funciona.
- [ ] Falha gera fallback honesto.
- [ ] OPENROUTER_APP_NAME aparece como Kuan-Yin, se o provider expuser.

## Resultado

- [ ] PASSOU
- [ ] PASSOU COM RESSALVAS
- [ ] BLOQUEADO
- [ ] FALHOU

## Incidentes

- Supabase real/staging não foi validado neste ambiente porque não há secrets reais configurados e a Supabase CLI não está disponível.
- Migrations não foram aplicadas para evitar operação destrutiva ou em produção sem ambiente explícito.
- OpenRouter real não foi validado neste ambiente porque OPENROUTER_API_KEY não está configurada.
- Smoke test de rotas reais ficou bloqueado por ausência de ambiente real/staging com autenticação e dados reais.
