ALTER TABLE public.trip_widgets
  ADD COLUMN IF NOT EXISTS monetization_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS itinerary_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS unlock_password_hash text,
  ADD COLUMN IF NOT EXISTS unlock_password_salt text;

ALTER TABLE public.trip_widgets
  ADD CONSTRAINT trip_widgets_itinerary_price_positive
  CHECK (itinerary_price IS NULL OR itinerary_price > 0) NOT VALID;

ALTER TABLE public.trip_widget_generations
  ADD COLUMN IF NOT EXISTS protected_text text,
  ADD COLUMN IF NOT EXISTS protected_original_text text,
  ADD COLUMN IF NOT EXISTS unlock_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlock_window_started_at timestamptz;

COMMENT ON COLUMN public.trip_widgets.unlock_password_hash IS 'PBKDF2-SHA256 hash for optional public itinerary unlock; never return publicly.';
COMMENT ON COLUMN public.trip_widgets.unlock_password_salt IS 'Random salt for optional public itinerary unlock; never return publicly.';
COMMENT ON COLUMN public.trip_widget_generations.protected_text IS 'Full delivered itinerary retained server-side when link monetization is enabled.';
COMMENT ON COLUMN public.trip_widget_generations.protected_original_text IS 'Full Portuguese source retained server-side when link monetization is enabled.';