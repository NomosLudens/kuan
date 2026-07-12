DO $$
BEGIN
  IF to_regprocedure('public.kuanyin_supersede_plan_decision(uuid,text,text,text,text,text,jsonb,text,timestamptz,boolean)') IS NULL THEN
    RAISE NOTICE 'Skipping kuanyin_supersede_plan_decision privilege hardening; function is created by 20260712004000_repair_kuan_plan_atomicity.sql.';
    RETURN;
  END IF;

  REVOKE ALL
  ON FUNCTION public.kuanyin_supersede_plan_decision(
    uuid,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    timestamptz,
    boolean
  )
  FROM PUBLIC;

  REVOKE ALL
  ON FUNCTION public.kuanyin_supersede_plan_decision(
    uuid,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    timestamptz,
    boolean
  )
  FROM anon;

  GRANT EXECUTE
  ON FUNCTION public.kuanyin_supersede_plan_decision(
    uuid,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    timestamptz,
    boolean
  )
  TO authenticated;
END $$;
