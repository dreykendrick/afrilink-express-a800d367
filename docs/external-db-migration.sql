-- ============================================================
-- EXTERNAL DATABASE MIGRATION
-- Run this on the main AfriLink Supabase project (ckklirhhwndijsjpmnfe)
-- ============================================================

-- 1) Add unified checkout fields to orders table
-- ============================================================

-- Source of the order: affiliate link or marketplace
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'affiliate_link'
  CHECK (source IN ('affiliate_link', 'marketplace'));

-- Buyer identity (nullable for guest checkouts)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid DEFAULT NULL;

-- Buyer role at time of purchase
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_role text DEFAULT 'guest'
  CHECK (buyer_role IN ('guest', 'customer', 'vendor', 'affiliate'));

-- Freeze affiliate commission rate at purchase time
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS affiliate_rate_at_purchase numeric DEFAULT NULL;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders (source);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_user_id ON public.orders (buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_role ON public.orders (buyer_role);

COMMENT ON COLUMN public.orders.source IS 'Where the order originated: affiliate_link or marketplace';
COMMENT ON COLUMN public.orders.buyer_user_id IS 'Auth user ID of the buyer, null for guests';
COMMENT ON COLUMN public.orders.buyer_role IS 'Role of the buyer at purchase time';
COMMENT ON COLUMN public.orders.affiliate_rate_at_purchase IS 'Frozen commission rate at time of purchase';


-- 2) Create ledger / payouts table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,

  -- Who receives this line item
  entry_type text NOT NULL CHECK (entry_type IN (
    'vendor_payout',      -- amount going to the product vendor
    'platform_fee',       -- AfriLink platform fee
    'affiliate_commission', -- commission to an affiliate (affiliate_link orders)
    'platform_commission'   -- commission routed to platform (marketplace vendor/affiliate buyers)
  )),

  -- Who gets paid (nullable — platform entries have no recipient user)
  recipient_id uuid DEFAULT NULL,
  recipient_type text DEFAULT NULL CHECK (recipient_type IN ('vendor', 'affiliate', 'platform')),

  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',

  -- Payout status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at timestamptz DEFAULT NULL,

  -- Metadata
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_ledger ENABLE ROW LEVEL SECURITY;

-- Only service role / admin can read ledger entries
CREATE POLICY "Ledger readable by service role"
  ON public.order_ledger FOR SELECT
  USING (true);  -- Tighten this based on your auth model

CREATE POLICY "Ledger insertable by service role"
  ON public.order_ledger FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Ledger updatable by service role"
  ON public.order_ledger FOR UPDATE
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_ledger_order_id ON public.order_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_order_ledger_recipient ON public.order_ledger (recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_order_ledger_status ON public.order_ledger (status);
CREATE INDEX IF NOT EXISTS idx_order_ledger_entry_type ON public.order_ledger (entry_type);

-- Auto-update updated_at
CREATE TRIGGER update_order_ledger_updated_at
  BEFORE UPDATE ON public.order_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.order_ledger IS 'Financial ledger entries for each order — vendor payouts, platform fees, and commissions';


-- 3) Example: DB function to generate ledger entries after payment confirmation
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_ledger(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_platform_fee_rate numeric := 0.10;  -- 10% platform fee (adjust as needed)
  v_vendor_amount numeric;
  v_platform_fee numeric;
  v_commission_amount numeric;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Calculate amounts
  v_commission_amount := COALESCE(v_order.affiliate_rate_at_purchase, 0) * v_order.item_price;
  v_platform_fee := v_platform_fee_rate * v_order.item_price;
  v_vendor_amount := v_order.item_price - v_platform_fee - v_commission_amount;

  -- Vendor payout
  INSERT INTO order_ledger (order_id, entry_type, recipient_id, recipient_type, amount)
  SELECT v_order.id, 'vendor_payout', p.vendor_id, 'vendor', v_vendor_amount
  FROM products p WHERE p.id = v_order.product_id;

  -- Platform fee
  INSERT INTO order_ledger (order_id, entry_type, recipient_type, amount)
  VALUES (v_order.id, 'platform_fee', 'platform', v_platform_fee);

  -- Commission routing
  IF v_order.source = 'affiliate_link' AND v_order.affiliate_id IS NOT NULL THEN
    -- Affiliate gets the commission
    INSERT INTO order_ledger (order_id, entry_type, recipient_id, recipient_type, amount)
    VALUES (v_order.id, 'affiliate_commission', v_order.affiliate_id, 'affiliate', v_commission_amount);
  ELSIF v_order.source = 'marketplace' AND v_order.buyer_role IN ('vendor', 'affiliate') THEN
    -- Platform gets the commission (marketplace purchase by vendor/affiliate)
    INSERT INTO order_ledger (order_id, entry_type, recipient_type, amount)
    VALUES (v_order.id, 'platform_commission', 'platform', v_commission_amount);
  END IF;
  -- For marketplace guest/customer purchases: no commission entry (v_commission_amount = 0)
END;
$$;

COMMENT ON FUNCTION public.generate_order_ledger IS 'Creates ledger entries for an order after payment confirmation';
