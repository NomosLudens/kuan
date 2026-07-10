# Kuan Environment Checklist

## Supabase

- [ ] SUPABASE_URL configurada no backend.
- [ ] SUPABASE_SERVICE_ROLE_KEY configurada apenas no backend.
- [ ] Chave pública/anon configurada apenas se o frontend precisar.
- [ ] Service role não aparece no bundle.
- [ ] Service role não aparece em logs.
- [ ] .env não foi commitado.
- [ ] .env.example não contém segredo real.

## OpenRouter

- [ ] OPENROUTER_API_KEY configurada no backend.
- [ ] OPENROUTER_APP_NAME configurada como Kuan-Yin.
- [ ] OPENROUTER_SITE_URL aponta para domínio real/staging.
- [ ] Modelo principal definido ou fallback aceitável usado.
- [ ] Falha de OpenRouter gera fallback honesto.

## Kuan-Yin

- [ ] Cap diário público configurado ou fallback documentado.
- [ ] Página pública não expõe Pix interno se política atual for esconder.
- [ ] Página pública não expõe IDs internos.
- [ ] Cliente sem login não recebe dados privados.

## Resultado

- [ ] Ambiente pronto após execução manual real.
- [ ] Ambiente pronto com ressalvas.
- [ ] Ambiente bloqueado.

## Estado deste PR

Este PR prepara o bring-up, mas não conclui a validação real porque o ambiente Codex não possui Supabase real/staging, secrets nem Supabase CLI. A execução real deve seguir `KUAN_MANUAL_BRING_UP_RUNBOOK.md`.
