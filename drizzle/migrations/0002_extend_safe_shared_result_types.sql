ALTER TABLE public.shared_results DROP CONSTRAINT IF EXISTS shared_results_kind_check;
ALTER TABLE public.shared_results ADD CONSTRAINT shared_results_kind_check
  CHECK (kind IN ('itinerary','translation','flight_search','travel_budget','document_translation'));