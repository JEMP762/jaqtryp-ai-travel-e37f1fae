CREATE TABLE public.user_onboarding (
  user_id uuid PRIMARY KEY,
  intent text NOT NULL DEFAULT 'direct' CHECK (intent IN ('itinerary','flight_search','image_translation','document_translation','travel_budget','direct')),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed','skipped')),
  current_step integer NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 10),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  variant text NOT NULL DEFAULT 'default',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_onboarding TO authenticated;
GRANT ALL ON public.user_onboarding TO service_role;
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own onboarding" ON public.user_onboarding FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('itinerary','translation','flight_search','travel_budget','document_translation')),
  title text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_results TO authenticated;
GRANT ALL ON public.user_results TO service_role;
ALTER TABLE public.user_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own results" ON public.user_results FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_results_user_recent_idx ON public.user_results (user_id, occurred_at DESC);

CREATE TABLE public.shared_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('itinerary','translation')),
  title text NOT NULL,
  summary text,
  public_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shared_results TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_results TO authenticated;
GRANT ALL ON public.shared_results TO service_role;
ALTER TABLE public.shared_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active shared results are public" ON public.shared_results FOR SELECT TO anon USING (active = true);
CREATE POLICY "owners read shared results" ON public.shared_results FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners insert shared results" ON public.shared_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update shared results" ON public.shared_results FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete shared results" ON public.shared_results FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  visitor_id text,
  event_name text NOT NULL CHECK (event_name IN ('shared_content_viewed','context_cta_clicked','signup_completed','onboarding_started','onboarding_completed','first_action','first_result','second_action','share_clicked','feature_discovered','return_visit','subscription_started')),
  feature text,
  source text,
  campaign text,
  variant text NOT NULL DEFAULT 'default',
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activation_events TO authenticated;
GRANT ALL ON public.activation_events TO service_role;
ALTER TABLE public.activation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own activation events" ON public.activation_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users read own activation events" ON public.activation_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX activation_events_funnel_idx ON public.activation_events (event_name, created_at DESC);
CREATE INDEX activation_events_user_idx ON public.activation_events (user_id, created_at DESC);