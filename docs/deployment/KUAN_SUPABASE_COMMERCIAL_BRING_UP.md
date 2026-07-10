# Kuan Supabase Commercial Bring-up

## Objetivo

Preparar a ligação da Kuan-Yin em Supabase comercial real/staging sem mock; a execução real permanece pendente fora deste ambiente Codex.

## Regras

- Nenhum segredo no repo.
- Service role só no backend.
- Cliente público nunca recebe service role.
- Comprovante recebido não é pagamento confirmado.
- Pedido de agendamento não é agendamento confirmado.
- Cliente sem login não executa ação administrativa.
- Guardião confirma ação sensível.

## Ambiente

- Data: 2026-07-10
- Branch: feat/kuan-supabase-commercial-bring-up
- Commit: a669914
- Supabase project: bloqueado; não informado neste ambiente.
- Ambiente: bloqueado; nenhum staging/produção/local real explícito configurado.
- Domínio: bloqueado; domínio real/staging não informado.
- OpenRouter configurado: não; OPENROUTER_API_KEY não está configurada neste ambiente.
- Supabase CLI disponível: não; `supabase` não está instalado no PATH.
- Migrations aplicadas: não; sem CLI e sem ambiente real/staging explícito.
- SQL real validado: não; sem conexão Supabase real/staging explícita.

## Variáveis necessárias

Listadas sem valores reais. Não commitar secrets.

### Frontend-safe

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_ANON_KEY

### Server-only

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_ANON_KEY
- OPENROUTER_API_KEY
- OPENROUTER_SITE_URL
- OPENROUTER_APP_NAME
- OPENROUTER_CHAT_MODEL
- OPENROUTER_CHAT_MODEL_FALLBACK
- OPENROUTER_FAST_MODEL
- APP_PUBLIC_URL
- KUAN_PUBLIC_DAILY_CAP
- KALINE_KUANYIN_PUBLIC_DAILY_CAP

## Passo a passo

1. Criar projeto Supabase comercial.
2. Configurar secrets no ambiente de deploy.
3. Aplicar baseline/migrations.
4. Validar tabelas Kuan.
5. Validar constraints.
6. Validar RLS/policies.
7. Validar OpenRouter.
8. Rodar smoke test.
9. Registrar bloqueios.

## Resultado

- [ ] BRING-UP PASSOU
- [ ] BRING-UP PASSOU COM RESSALVAS
- [x] BRING-UP BLOQUEADO
- [ ] BRING-UP FALHOU

## Bloqueios registrados

- Ambiente sem origin/main; base aceita por checkout limpo e histórico contendo PR 9 mergeado.
- PR 12 e PR 13 também aparecem no histórico local antes deste bring-up.
- Supabase real/staging não foi usado porque não há project ref, URL, chaves ou confirmação de staging/produção no ambiente.
- Supabase CLI não está disponível; migrations não foram listadas, aplicadas ou lintadas.
- SQL de inspeção foi criado, mas não rodado contra banco real.
- OpenRouter não foi validado por ausência de OPENROUTER_API_KEY no ambiente.
- Smoke test real de rotas ficou bloqueado por ausência de ambiente real/staging com autenticação e dados reais.

## Auditoria de envs consumidas

### Supabase

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_ANON_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_ANON_KEY

### OpenRouter

- OPENROUTER_API_KEY
- OPENROUTER_SITE_URL
- OPENROUTER_APP_NAME
- OPENROUTER_CHAT_MODEL
- OPENROUTER_CHAT_MODEL_FALLBACK
- OPENROUTER_FAST_MODEL
- OPENROUTER_TEXT_MODEL_PRIMARY
- OPENROUTER_MODEL_PRIMARY
- OPENROUTER_MODEL
- OPENROUTER_TRIAGE_MODEL
- OPENROUTER_TEXT_MODEL_FALLBACK_2
- OPENROUTER_REASONING_MODEL
- OPENROUTER_TEXT_MODEL_FALLBACK_1
- OPENROUTER_MODEL_FALLBACK_2
- OPENROUTER_VISION_MODEL_PRIMARY
- OPENROUTER_PDF_MODEL
- OPENROUTER_DOCUMENT_MODEL
- OPENROUTER_TTS_MODEL
- OPENROUTER_TTS_PRIMARY_MODEL
- OPENROUTER_TTS_VOICE
- OPENROUTER_TRANSCRIBE_MODEL
- OPENROUTER_STT_PRIMARY_MODEL
- OPENROUTER_STT_FALLBACK_MODEL
- OPENROUTER_IMAGE_MODEL
- OPENROUTER_TTS_FALLBACK_MODEL
- OPENROUTER_TTS_FALLBACK_VOICE

### Kuan / app

- KUAN_PUBLIC_DAILY_CAP
- KALINE_KUANYIN_PUBLIC_DAILY_CAP
- KUANYIN_IMAGE_READING_MODEL
- APP_PUBLIC_URL
- KALINE_STT_LANGUAGE
- KALINE_ATTACHMENT_MAX_BYTES
- KALINE_BRIDGE_SHARED_KEY

## Estado deste PR

Este PR prepara o bring-up, mas não conclui a validação real porque o ambiente Codex não possui Supabase real/staging, secrets nem Supabase CLI. A execução real deve seguir `KUAN_MANUAL_BRING_UP_RUNBOOK.md`.
