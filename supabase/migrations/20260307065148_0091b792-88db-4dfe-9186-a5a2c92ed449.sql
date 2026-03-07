
-- 1. Create delivery_settings table
CREATE TABLE public.delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  base_fee numeric NOT NULL DEFAULT 1500,
  price_per_km numeric NOT NULL DEFAULT 500,
  minimum_fee numeric NOT NULL DEFAULT 1500,
  maximum_fee numeric DEFAULT NULL,
  free_delivery_threshold numeric DEFAULT NULL,
  max_delivery_distance_km numeric DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: publicly readable, admin-managed via service role
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Delivery settings are publicly readable" ON public.delivery_settings FOR SELECT USING (true);

-- Insert default row
INSERT INTO public.delivery_settings (enabled, base_fee, price_per_km, minimum_fee) VALUES (true, 1500, 500, 1500);

-- 2. Add vendor coordinates
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS lat numeric DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS lng numeric DEFAULT NULL;

-- 3. Add delivery fields to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat numeric DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng numeric DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS distance_km numeric DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_settings_snapshot jsonb DEFAULT NULL;

-- 4. Make buyer_city_id nullable (no longer required)
ALTER TABLE public.orders ALTER COLUMN buyer_city_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN buyer_city_id SET DEFAULT NULL;
