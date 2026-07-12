CREATE TABLE IF NOT EXISTS public.kuanyin_business_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id uuid NOT NULL REFERENCES public.kuanyin_guardians(id) ON DELETE CASCADE,
  business_context_id uuid NOT NULL REFERENCES public.business_contexts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Plano de Negócio',
  mission text,
  vision text,
  current_direction text,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  challenges jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','in_review','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_id, business_context_id),
  CHECK (jsonb_typeof(objectives) = 'array'), CHECK (jsonb_typeof(strengths) = 'array'), CHECK (jsonb_typeof(challenges) = 'array')
);
CREATE TABLE IF NOT EXISTS public.kuanyin_plan_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.kuanyin_business_plans(id) ON DELETE CASCADE,
  title text NOT NULL, decision_type text NOT NULL DEFAULT 'other' CHECK (decision_type IN ('strategy','pricing','service','client_policy','schedule','communication','operations','marketing','finance','risk','other')),
  context text, decision_text text NOT NULL, rationale text, consequences jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','in_review','superseded','rejected','archived')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  review_at timestamptz, accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, accepted_at timestamptz,
  superseded_by uuid REFERENCES public.kuanyin_plan_decisions(id) ON DELETE SET NULL,
  source_thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL, source_message_ids uuid[] NOT NULL DEFAULT '{}', metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(consequences) = 'array'), CHECK (jsonb_typeof(metadata) = 'object'), CHECK (superseded_by IS NULL OR superseded_by <> id)
);
CREATE TABLE IF NOT EXISTS public.kuanyin_plan_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.kuanyin_business_plans(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.kuanyin_plan_decisions(id) ON DELETE SET NULL, title text NOT NULL, description text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','delayed','blocked','cancelled')),
  starts_at timestamptz, due_at timestamptz, completed_at timestamptz, responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_at IS NULL OR starts_at IS NULL OR due_at >= starts_at), CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE TABLE IF NOT EXISTS public.kuanyin_plan_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.kuanyin_business_plans(id) ON DELETE CASCADE,
  cadence text NOT NULL CHECK (cadence IN ('weekly','monthly','quarterly')), label text NOT NULL, is_active boolean NOT NULL DEFAULT true,
  next_review_at timestamptz, last_review_at timestamptz, checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(plan_id, cadence), CHECK (jsonb_typeof(checklist) = 'array')
);
CREATE TABLE IF NOT EXISTS public.kuanyin_plan_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.kuanyin_business_plans(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.kuanyin_plan_review_cycles(id) ON DELETE SET NULL, title text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  scheduled_at timestamptz, started_at timestamptz, completed_at timestamptz, summary text,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb, inferences jsonb NOT NULL DEFAULT '[]'::jsonb, proposals jsonb NOT NULL DEFAULT '[]'::jsonb, next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions_reviewed uuid[] NOT NULL DEFAULT '{}', metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.kuanyin_plan_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES public.kuanyin_business_plans(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.kuanyin_plan_decisions(id) ON DELETE CASCADE, milestone_id uuid REFERENCES public.kuanyin_plan_milestones(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.kuanyin_plan_reviews(id) ON DELETE CASCADE, entity_type text NOT NULL CHECK (entity_type IN ('client','appointment','order','payment','public_thread')),
  entity_id uuid NOT NULL, relation_type text NOT NULL DEFAULT 'related', notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(decision_id, milestone_id, review_id) <= 1)
);

CREATE INDEX IF NOT EXISTS kuanyin_business_plans_guardian_context_idx ON public.kuanyin_business_plans(guardian_id, business_context_id);
CREATE INDEX IF NOT EXISTS kuanyin_plan_decisions_plan_status_review_idx ON public.kuanyin_plan_decisions(plan_id, status, review_at);
CREATE INDEX IF NOT EXISTS kuanyin_plan_milestones_plan_status_due_idx ON public.kuanyin_plan_milestones(plan_id, status, due_at);
CREATE INDEX IF NOT EXISTS kuanyin_plan_review_cycles_plan_cadence_idx ON public.kuanyin_plan_review_cycles(plan_id, cadence);
CREATE INDEX IF NOT EXISTS kuanyin_plan_reviews_plan_status_scheduled_idx ON public.kuanyin_plan_reviews(plan_id, status, scheduled_at);
CREATE UNIQUE INDEX IF NOT EXISTS kuanyin_plan_links_unique_entity_idx ON public.kuanyin_plan_links(plan_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS kuanyin_plan_links_plan_entity_idx ON public.kuanyin_plan_links(plan_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS kuanyin_plan_links_decision_idx ON public.kuanyin_plan_links(decision_id);
CREATE INDEX IF NOT EXISTS kuanyin_plan_links_milestone_idx ON public.kuanyin_plan_links(milestone_id);

DO $$ DECLARE r record; BEGIN
  IF to_regprocedure('public.touch_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'public.touch_updated_at() is required before creating Kuan plan triggers';
  END IF;
  FOR r IN SELECT unnest(ARRAY['kuanyin_business_plans','kuanyin_plan_decisions','kuanyin_plan_milestones','kuanyin_plan_review_cycles','kuanyin_plan_reviews','kuanyin_plan_links']) AS t LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch_updated_at ON public.%I', r.t, r.t);
    EXECUTE format('CREATE TRIGGER %I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', r.t, r.t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.kuanyin_can_own_plan(p_guardian_id uuid, p_business_context_id uuid)
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

CREATE POLICY kuanyin_business_plans_owner_all ON public.kuanyin_business_plans FOR ALL TO authenticated
  USING (public.kuanyin_can_own_plan(guardian_id, business_context_id))
  WITH CHECK (public.kuanyin_can_own_plan(guardian_id, business_context_id));
CREATE POLICY kuanyin_plan_decisions_owner_all ON public.kuanyin_plan_decisions FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_milestones_owner_all ON public.kuanyin_plan_milestones FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_review_cycles_owner_all ON public.kuanyin_plan_review_cycles FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_reviews_owner_all ON public.kuanyin_plan_reviews FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_links_owner_all ON public.kuanyin_plan_links FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));

GRANT SELECT, INSERT, UPDATE ON public.kuanyin_business_plans, public.kuanyin_plan_decisions, public.kuanyin_plan_milestones, public.kuanyin_plan_review_cycles, public.kuanyin_plan_reviews, public.kuanyin_plan_links TO authenticated;
GRANT DELETE ON public.kuanyin_plan_links TO authenticated;


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
BEGIN
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

  INSERT INTO public.kuanyin_plan_decisions (
    plan_id, title, decision_type, context, decision_text, rationale, consequences,
    priority, review_at, status, accepted_by, accepted_at
  ) VALUES (
    v_old.plan_id, p_title, p_decision_type, p_context, p_decision_text, p_rationale,
    COALESCE(p_consequences, '[]'::jsonb), p_priority, p_review_at,
    CASE WHEN p_accept_now THEN 'accepted' ELSE 'proposed' END,
    CASE WHEN p_accept_now THEN auth.uid() ELSE NULL END,
    CASE WHEN p_accept_now THEN now() ELSE NULL END
  )
  RETURNING * INTO v_created;

  UPDATE public.kuanyin_plan_decisions
  SET status = 'superseded', superseded_by = v_created.id
  WHERE id = v_old.id;

  RETURN v_created;
END $$;

GRANT EXECUTE
ON FUNCTION public.kuanyin_supersede_plan_decision(
  uuid, text, text, text, text, text, jsonb, text, timestamptz, boolean
)
TO authenticated;


CREATE OR REPLACE FUNCTION public.kuanyin_validate_plan_relationships() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'kuanyin_plan_milestones' AND NEW.decision_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.kuanyin_plan_decisions d WHERE d.id = NEW.decision_id AND d.plan_id = NEW.plan_id) THEN
      RAISE EXCEPTION 'decision_id must belong to the same plan';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'kuanyin_plan_reviews' AND NEW.cycle_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.kuanyin_plan_review_cycles c WHERE c.id = NEW.cycle_id AND c.plan_id = NEW.plan_id) THEN
      RAISE EXCEPTION 'cycle_id must belong to the same plan';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'kuanyin_plan_links' THEN
    IF NEW.decision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kuanyin_plan_decisions d WHERE d.id = NEW.decision_id AND d.plan_id = NEW.plan_id) THEN
      RAISE EXCEPTION 'decision_id must belong to the same plan';
    END IF;
    IF NEW.milestone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kuanyin_plan_milestones m WHERE m.id = NEW.milestone_id AND m.plan_id = NEW.plan_id) THEN
      RAISE EXCEPTION 'milestone_id must belong to the same plan';
    END IF;
    IF NEW.review_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.kuanyin_plan_reviews r WHERE r.id = NEW.review_id AND r.plan_id = NEW.plan_id) THEN
      RAISE EXCEPTION 'review_id must belong to the same plan';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kuanyin_plan_milestones_validate_relationships ON public.kuanyin_plan_milestones;
CREATE TRIGGER kuanyin_plan_milestones_validate_relationships
  BEFORE INSERT OR UPDATE ON public.kuanyin_plan_milestones
  FOR EACH ROW EXECUTE FUNCTION public.kuanyin_validate_plan_relationships();

DROP TRIGGER IF EXISTS kuanyin_plan_reviews_validate_relationships ON public.kuanyin_plan_reviews;
CREATE TRIGGER kuanyin_plan_reviews_validate_relationships
  BEFORE INSERT OR UPDATE ON public.kuanyin_plan_reviews
  FOR EACH ROW EXECUTE FUNCTION public.kuanyin_validate_plan_relationships();

DROP TRIGGER IF EXISTS kuanyin_plan_links_validate_relationships ON public.kuanyin_plan_links;
CREATE TRIGGER kuanyin_plan_links_validate_relationships
  BEFORE INSERT OR UPDATE ON public.kuanyin_plan_links
  FOR EACH ROW EXECUTE FUNCTION public.kuanyin_validate_plan_relationships();
