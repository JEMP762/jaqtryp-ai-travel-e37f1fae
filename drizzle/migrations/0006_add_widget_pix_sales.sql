CREATE TABLE public.mercadopago_connections (
  owner_id uuid PRIMARY KEY,
  mp_user_id text NOT NULL,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercadopago_connections TO authenticated;
GRANT ALL ON public.mercadopago_connections TO service_role;
ALTER TABLE public.mercadopago_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own Mercado Pago connection" ON public.mercadopago_connections
FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.widget_itinerary_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.trip_widget_generations(id) ON DELETE CASCADE,
  widget_id uuid NOT NULL REFERENCES public.trip_widgets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  visitor_hash text NOT NULL,
  provider text NOT NULL DEFAULT 'mercado_pago',
  provider_payment_id text UNIQUE,
  amount_brl numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_id)
);
GRANT SELECT ON public.widget_itinerary_purchases TO authenticated;
GRANT ALL ON public.widget_itinerary_purchases TO service_role;
ALTER TABLE public.widget_itinerary_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own itinerary sales" ON public.widget_itinerary_purchases
FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX widget_itinerary_purchases_payment_idx ON public.widget_itinerary_purchases(provider_payment_id);
CREATE INDEX widget_itinerary_purchases_generation_idx ON public.widget_itinerary_purchases(generation_id, visitor_hash);
CREATE TRIGGER widget_itinerary_purchases_touch BEFORE UPDATE ON public.widget_itinerary_purchases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER mercadopago_connections_touch BEFORE UPDATE ON public.mercadopago_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.trip_widget_generations ADD COLUMN payment_unlocked_at timestamptz;
ALTER TABLE public.trip_widgets ADD COLUMN mercadopago_connected boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.trip_widgets.payment_url IS 'DEPRECATED: replaced by connected Mercado Pago PIX checkout';
COMMENT ON COLUMN public.trip_widgets.unlock_password_hash IS 'DEPRECATED: automatic payment confirmation replaces passwords';
COMMENT ON COLUMN public.trip_widgets.unlock_password_salt IS 'DEPRECATED: automatic payment confirmation replaces passwords';