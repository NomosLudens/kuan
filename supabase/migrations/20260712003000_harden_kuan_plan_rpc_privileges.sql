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
