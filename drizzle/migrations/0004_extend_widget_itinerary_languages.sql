ALTER TABLE public.trip_widget_generations
  ADD COLUMN currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN source_language text NOT NULL DEFAULT 'pt',
  ADD COLUMN result_hash text,
  ADD COLUMN translation_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN translated_languages text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.trip_widget_generations
  ADD CONSTRAINT trip_widget_generations_currency_format
  CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT trip_widget_generations_source_language_allowed
  CHECK (source_language = ANY (ARRAY['pt','en','es','fr','it','de','ja','zh','ko','ar','ru'])),
  ADD CONSTRAINT trip_widget_generations_translation_credits_nonnegative
  CHECK (translation_credits >= 0);