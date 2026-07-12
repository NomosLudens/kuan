CREATE OR REPLACE FUNCTION public.kuanyin_can_own_plan(
  p_guardian_id uuid,
  p_business_context_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kuanyin_guardians g
    JOIN public.business_contexts bc ON bc.id = p_business_context_id
    WHERE g.id = p_guardian_id
      AND g.user_id = auth.uid()
      AND g.business_context_id = p_business_context_id
      AND bc.user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.kuanyin_can_own_plan(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kuanyin_can_own_plan(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.kuanyin_can_own_plan(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.kuanyin_plan_owned(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kuanyin_business_plans p
    WHERE p.id = p_plan_id
      AND public.kuanyin_can_own_plan(p.guardian_id, p.business_context_id)
  )
$$;

REVOKE ALL ON FUNCTION public.kuanyin_plan_owned(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kuanyin_plan_owned(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.kuanyin_plan_owned(uuid) TO authenticated;

DROP POLICY IF EXISTS kuanyin_business_plans_owner_all
ON public.kuanyin_business_plans;

CREATE POLICY kuanyin_business_plans_owner_all
ON public.kuanyin_business_plans
FOR ALL
TO authenticated
USING (
  public.kuanyin_can_own_plan(
    guardian_id,
    business_context_id
  )
)
WITH CHECK (
  public.kuanyin_can_own_plan(
    guardian_id,
    business_context_id
  )
);

CREATE OR REPLACE FUNCTION public.kuanyin_supersede_plan_decision(
  p_old_decision_id uuid,
  p_title text,
  p_decision_type text,
  p_context text,
  p_decision_text text,
  p_rationale text,
  p_consequences jsonb,
  p_priority text,
  p_review_at timestamptz,
  p_accept_now boolean DEFAULT false
)
RETURNS public.kuanyin_plan_decisions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.kuanyin_plan_decisions%ROWTYPE;
  v_created public.kuanyin_plan_decisions%ROWTYPE;
  v_new_status text;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;
  IF p_decision_text IS NULL OR btrim(p_decision_text) = '' THEN
    RAISE EXCEPTION 'decision_text is required';
  END IF;
  IF p_decision_type NOT IN ('strategy','pricing','service','client_policy','schedule','communication','operations','marketing','finance','risk','other') THEN
    RAISE EXCEPTION 'invalid decision_type';
  END IF;
  IF p_priority NOT IN ('low','medium','high','critical') THEN
    RAISE EXCEPTION 'invalid priority';
  END IF;
  IF COALESCE(jsonb_typeof(p_consequences), 'array') <> 'array' THEN
    RAISE EXCEPTION 'consequences must be an array';
  END IF;

  SELECT * INTO v_old
  FROM public.kuanyin_plan_decisions
  WHERE id = p_old_decision_id
    AND status IN ('accepted','in_review')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A decisão original não pode ser substituída neste estado.';
  END IF;

  IF NOT public.kuanyin_plan_owned(v_old.plan_id) THEN
    RAISE EXCEPTION 'A decisão original não pertence a este plano.';
  END IF;

  v_new_status := CASE WHEN p_accept_now THEN 'accepted' ELSE 'proposed' END;

  INSERT INTO public.kuanyin_plan_decisions (
    plan_id,
    title,
    decision_type,
    context,
    decision_text,
    rationale,
    consequences,
    priority,
    review_at,
    status,
    accepted_by,
    accepted_at
  ) VALUES (
    v_old.plan_id,
    p_title,
    p_decision_type,
    p_context,
    p_decision_text,
    p_rationale,
    COALESCE(p_consequences, '[]'::jsonb),
    p_priority,
    p_review_at,
    v_new_status,
    CASE WHEN p_accept_now THEN auth.uid() ELSE NULL END,
    CASE WHEN p_accept_now THEN now() ELSE NULL END
  )
  RETURNING * INTO v_created;

  UPDATE public.kuanyin_plan_decisions
  SET status = 'superseded',
      superseded_by = v_created.id
  WHERE id = v_old.id;

  RETURN v_created;
END $$;

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
