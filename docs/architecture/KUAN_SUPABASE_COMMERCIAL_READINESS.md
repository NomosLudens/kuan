# Kuan Commercial Supabase Readiness

## Decisão

Kuan-Yin deve usar Supabase comercial próprio em produção vendável.

## Regra

Kaline pessoal e Kuan-Yin comercial não devem compartilhar banco em produção vendável.

## Neste PR

* Nenhuma migration.
* Nenhuma cópia de dados.
* Nenhuma troca automática de projeto.
* Apenas contrato operacional e auditoria.

## Variáveis esperadas

Variáveis atuais usadas pelo app para Supabase:

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_PUBLISHABLE_KEY`
* `VITE_SUPABASE_ANON_KEY`
* `SUPABASE_URL`
* `SUPABASE_PUBLISHABLE_KEY`
* `SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY`

## Produção

Em produção da Kuan-Yin, essas variáveis devem apontar para o projeto Supabase comercial da Kuan-Yin.

## Proibido

* service role no frontend;
* misturar memória pessoal da Kaline com clientes/comprovantes;
* copiar dados manualmente sem plano;
* rodar migration destrutiva.

## Migração futura

A migração real deve ser PR separado, com:

* backup;
* migrations revisadas;
* RLS validado;
* smoke test;
* rollback plan.
