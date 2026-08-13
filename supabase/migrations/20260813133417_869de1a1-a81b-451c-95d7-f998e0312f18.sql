CREATE TABLE public.pix_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mercado_pago',
  payment_method text NOT NULL DEFAULT 'pix',
  mp_payment_id text UNIQUE,
  lookup_key text NOT NULL,
  credits integer NOT NULL,
  amount_brl numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamp with time zone,
  credited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pix_payments TO authenticated;
GRANT ALL ON public.pix_payments TO service_role;

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pix_payments_select_own"
  ON public.pix_payments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX pix_payments_user_idx ON public.pix_payments(user_id, created_at DESC);
CREATE INDEX pix_payments_status_idx ON public.pix_payments(status);

CREATE TRIGGER pix_payments_touch
  BEFORE UPDATE ON public.pix_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();