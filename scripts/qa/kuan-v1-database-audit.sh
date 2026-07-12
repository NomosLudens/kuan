#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Missing SUPABASE_DB_URL" >&2
  exit 1
fi

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
DO $$
DECLARE
  failures text;
BEGIN
  WITH expected(name, security_type) AS (
    VALUES
      ('kuanyin_can_own_plan', 'DEFINER'),
      ('kuanyin_plan_owned', 'DEFINER'),
      ('kuanyin_supersede_plan_decision', 'INVOKER')
  ), actual AS (
    SELECT routine_name, security_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'kuanyin_can_own_plan',
        'kuanyin_plan_owned',
        'kuanyin_supersede_plan_decision'
      )
  )
  SELECT string_agg(e.name || ' expected ' || e.security_type || ' got ' || COALESCE(a.security_type, 'missing'), '; ')
  INTO failures
  FROM expected e
  LEFT JOIN actual a ON a.routine_name = e.name
  WHERE a.routine_name IS NULL OR a.security_type <> e.security_type;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'Kuan v1 function security audit failed: %', failures;
  END IF;
END $$;

DO $$
DECLARE
  public_can_execute boolean;
  anon_can_execute boolean;
  authenticated_can_execute boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'kuanyin_supersede_plan_decision'
      AND privilege_type = 'EXECUTE'
      AND grantee = 'PUBLIC'
  ) INTO public_can_execute;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'kuanyin_supersede_plan_decision'
      AND privilege_type = 'EXECUTE'
      AND grantee = 'anon'
  ) INTO anon_can_execute;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'kuanyin_supersede_plan_decision'
      AND privilege_type = 'EXECUTE'
      AND grantee = 'authenticated'
  ) INTO authenticated_can_execute;

  IF public_can_execute THEN
    RAISE EXCEPTION 'PUBLIC can execute kuanyin_supersede_plan_decision';
  END IF;
  IF anon_can_execute THEN
    RAISE EXCEPTION 'anon can execute kuanyin_supersede_plan_decision';
  END IF;
  IF NOT authenticated_can_execute THEN
    RAISE EXCEPTION 'authenticated cannot execute kuanyin_supersede_plan_decision';
  END IF;
END $$;

SELECT 'PASS Kuan v1 function security and RPC grant audit' AS audit;
SQL
