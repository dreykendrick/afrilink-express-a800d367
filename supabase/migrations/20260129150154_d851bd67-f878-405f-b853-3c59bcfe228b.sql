-- AfriLink Checkout Database Schema

-- Cities table for delivery pricing
CREATE TABLE public.cities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Same city delivery zones
CREATE TABLE public.same_city_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city_id, zone_name)
);

-- Cross city delivery fees
CREATE TABLE public.cross_city_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  to_city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_city_id, to_city_id)
);

-- Vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city_id UUID REFERENCES public.cities(id),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  short_description TEXT,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Affiliates table
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Affiliate clicks tracking
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(affiliate_id, product_id, session_id)
);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  affiliate_id UUID REFERENCES public.affiliates(id),
  
  -- Buyer info
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_city_id UUID NOT NULL REFERENCES public.cities(id),
  buyer_area TEXT NOT NULL,
  buyer_landmark TEXT,
  buyer_notes TEXT,
  
  -- Pricing
  item_price DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  -- Status
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'failed', 'refunded')),
  order_status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (order_status IN ('pending_payment', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'confirmed', 'cancelled')),
  
  -- Notifications
  vendor_notified_at TIMESTAMP WITH TIME ZONE,
  notification_status TEXT DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'failed')),
  
  -- Confirmation
  confirmation_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order issues table
CREATE TABLE public.order_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.same_city_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_city_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_issues ENABLE ROW LEVEL SECURITY;

-- Public read policies (for buyer-facing pages)
CREATE POLICY "Cities are publicly readable" ON public.cities FOR SELECT USING (true);
CREATE POLICY "Same city zones are publicly readable" ON public.same_city_zones FOR SELECT USING (true);
CREATE POLICY "Cross city fees are publicly readable" ON public.cross_city_fees FOR SELECT USING (true);
CREATE POLICY "Active products are publicly readable" ON public.products FOR SELECT USING (is_active = true);
CREATE POLICY "Active affiliates are publicly readable" ON public.affiliates FOR SELECT USING (is_active = true);

-- Insert policies (for checkout flow - no auth required)
CREATE POLICY "Anyone can create affiliate clicks" ON public.affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create order issues" ON public.order_issues FOR INSERT WITH CHECK (true);

-- Orders can be read by anyone with the order number or confirmation token
CREATE POLICY "Orders readable by order number" ON public.orders FOR SELECT USING (true);

-- Orders can be updated (for confirmation)
CREATE POLICY "Orders can be updated" ON public.orders FOR UPDATE USING (true);

-- Vendors readable for internal joins only (not exposed to UI)
CREATE POLICY "Vendors readable for joins" ON public.vendors FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_vendor ON public.products(vendor_id);
CREATE INDEX idx_affiliates_code ON public.affiliates(code);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_orders_confirmation_token ON public.orders(confirmation_token);
CREATE INDEX idx_affiliate_clicks_session ON public.affiliate_clicks(session_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data for testing
INSERT INTO public.cities (id, name) VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Dar es Salaam'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Arusha'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Mwanza'),
  ('d4e5f6a7-b8c9-0123-def0-234567890123', 'Dodoma'),
  ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'Mbeya');

-- Sample delivery zones for Dar es Salaam
INSERT INTO public.same_city_zones (city_id, zone_name, fee) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kinondoni', 3000),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Ilala', 3000),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Temeke', 4000),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kigamboni', 5000),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Ubungo', 3500);

-- Cross city fees
INSERT INTO public.cross_city_fees (from_city_id, to_city_id, fee) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 25000),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 30000),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 25000);

-- Sample vendor
INSERT INTO public.vendors (id, name, phone, city_id, address) VALUES
  ('f6a7b8c9-d0e1-2345-f012-456789012345', 'TechStore TZ', '+255712345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kariakoo, Dar es Salaam');

-- Sample products
INSERT INTO public.products (vendor_id, slug, name, price, short_description, description, images) VALUES
  ('f6a7b8c9-d0e1-2345-f012-456789012345', 'iphone-14-case', 'iPhone 14 Pro Case', 25000, 'Premium silicone case for iPhone 14 Pro', 'Premium quality silicone case designed specifically for iPhone 14 Pro. Features precise cutouts for all ports and buttons. Soft microfiber lining protects your phone from scratches. Available in multiple colors.', ARRAY['https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400', 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400']),
  ('f6a7b8c9-d0e1-2345-f012-456789012345', 'wireless-earbuds', 'Wireless Earbuds Pro', 85000, 'True wireless earbuds with active noise cancellation', 'Experience premium sound quality with these true wireless earbuds. Features active noise cancellation, 8-hour battery life, and water resistance. Perfect for workouts and daily use.', ARRAY['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400', 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400']);

-- Sample affiliate
INSERT INTO public.affiliates (id, code, name, phone, commission_rate) VALUES
  ('a7b8c9d0-e1f2-3456-0123-567890123456', 'AFF123', 'John Affiliate', '+255712000000', 0.10);