# Kuan Manual Bring-up Runbook

## Objetivo

Executar fora do Codex o bring-up real da Kuan-Yin em Supabase comercial/staging.

## Pré-requisitos

- Acesso ao projeto Supabase comercial/staging.
- Acesso ao ambiente de deploy.
- SUPABASE_URL.
- SUPABASE_SERVICE_ROLE_KEY.
- Chave pública/anon ou publishable key, se o frontend usar.
- OPENROUTER_API_KEY.
- Supabase CLI instalado localmente, se for aplicar migrations por CLI.
- Repo clonado com origin/main real.

## Regras de segurança

- Nunca commitar .env real.
- Nunca colar service role em issue, PR, chat público ou docs.
- Service role só no backend.
- OPENROUTER_API_KEY só no ambiente.
- Não rodar reset de banco.
- Não rodar migration destrutiva.
- Não usar produção antes de testar staging.
- Não usar mock para marcar checklist como concluído.

## Passo 1 — preparar repo local

Comandos:

```sh
git clone https://github.com/Tonyus-dev/kuan.git
cd kuan
git checkout main
git pull --ff-only origin main
```

## Passo 2 — configurar env local

Criar .env local não commitado.

Variáveis:

```sh
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_APP_NAME=Kuan-Yin
OPENROUTER_SITE_URL=
KUAN_PUBLIC_DAILY_CAP=200
```

Adicionar frontend-safe apenas se o app exigir:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Passo 3 — validar que secrets não serão commitados

Comandos:

```sh
git status --short
git check-ignore .env || true
rg -n "SUPABASE_SERVICE_ROLE_KEY=.+|OPENROUTER_API_KEY=.+|sb_secret_|eyJ" . || true
```

Se aparecer segredo real:
parar.

## Passo 4 — rodar inspeção SQL

Rodar no Supabase SQL Editor ou via CLI o arquivo:

`docs/deployment/KUAN_SUPABASE_INSPECTION.sql`

Salvar resultados localmente, fora do repo, ou colar resumo sanitizado no PR 11.

Validar:

- tabelas Kuan existem;
- constraints reais;
- índices reais;
- RLS ativo;
- policies reais;
- grants anon/authenticated.

## Passo 5 — aplicar migrations, se necessário

Só aplicar migrations aprovadas.

Proibido:

- reset;
- drop;
- rename;
- truncate;
- migration não revisada.

Se o banco estiver vazio/staging:
avaliar baseline.

Se o banco já existir:
não aplicar baseline cegamente.

## Passo 6 — smoke test real

Rodar:

```sh
bun install
bun run typecheck
bun run test
bun run build
bun run preview --host 127.0.0.1 --port 4173
```

Validar manualmente:

- /kuan-yin
- /kuan-yin/config
- /kuan-yin/inbox
- /kuan-yin/revisao
- /kuan-yin/agendamentos
- /kuan-yin/pedidos
- /kuan-yin/pagamentos
- /g/:guardianSlug

## Passo 7 — OpenRouter

Validar:

- OPENROUTER_API_KEY presente.
- X-Title = Kuan-Yin ou OPENROUTER_APP_NAME.
- Falha gera fallback honesto.
- Nenhum segredo aparece no client bundle.

## Passo 8 — registrar incidentes para PR 11

Criar uma lista objetiva:

- pending vs pending_review:
- warn/block vs warning/critical:
- RLS/policies:
- grants anon:
- índices:
- rota pública:
- inbox:
- OpenRouter:
- qualquer erro real:

## Saída

Uma das opções:

- Pronto para PR 11.
- Pronto com ressalvas.
- Bloqueado.
