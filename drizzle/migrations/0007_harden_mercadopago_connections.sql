REVOKE ALL ON public.mercadopago_connections FROM authenticated;
DROP POLICY IF EXISTS "Owners manage own Mercado Pago connection" ON public.mercadopago_connections;