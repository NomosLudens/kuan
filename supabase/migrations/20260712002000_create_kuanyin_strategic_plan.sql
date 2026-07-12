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

DO $$ DECLARE r record; BEGIN FOR r IN SELECT unnest(ARRAY['kuanyin_business_plans','kuanyin_plan_decisions','kuanyin_plan_milestones','kuanyin_plan_review_cycles','kuanyin_plan_reviews','kuanyin_plan_links']) AS t LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t); EXECUTE format('DROP TRIGGER IF EXISTS %I_touch_updated_at ON public.%I', r.t, r.t); EXECUTE format('CREATE TRIGGER %I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', r.t, r.t); END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.kuanyin_plan_owned(p_plan_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kuanyin_business_plans p JOIN public.kuanyin_guardians g ON g.id = p.guardian_id WHERE p.id = p_plan_id AND g.user_id = auth.uid())
$$;
CREATE POLICY kuanyin_business_plans_owner_all ON public.kuanyin_business_plans FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.kuanyin_guardians g WHERE g.id = guardian_id AND g.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.kuanyin_guardians g WHERE g.id = guardian_id AND g.user_id = auth.uid()));
CREATE POLICY kuanyin_plan_decisions_owner_all ON public.kuanyin_plan_decisions FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_milestones_owner_all ON public.kuanyin_plan_milestones FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_review_cycles_owner_all ON public.kuanyin_plan_review_cycles FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_reviews_owner_all ON public.kuanyin_plan_reviews FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));
CREATE POLICY kuanyin_plan_links_owner_all ON public.kuanyin_plan_links FOR ALL TO authenticated USING (public.kuanyin_plan_owned(plan_id)) WITH CHECK (public.kuanyin_plan_owned(plan_id));

GRANT SELECT, INSERT, UPDATE ON public.kuanyin_business_plans, public.kuanyin_plan_decisions, public.kuanyin_plan_milestones, public.kuanyin_plan_review_cycles, public.kuanyin_plan_reviews, public.kuanyin_plan_links TO authenticated;
GRANT DELETE ON public.kuanyin_plan_links TO authenticated;
