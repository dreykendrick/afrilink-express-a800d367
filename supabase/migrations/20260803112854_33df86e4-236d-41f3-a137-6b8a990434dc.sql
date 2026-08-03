ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS meetpay_payment_id text;
CREATE INDEX IF NOT EXISTS orders_meetpay_payment_id_idx ON public.orders (meetpay_payment_id);