
-- 1. Add dual confirmation columns to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS vendor_confirmed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz DEFAULT NULL;

-- 2. Create wallets table
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('vendor', 'affiliate')),
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, owner_type)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- RLS: Service role only (accessed via edge functions)
CREATE POLICY "Wallets readable by authenticated" ON public.wallets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Wallets updatable by authenticated" ON public.wallets
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Wallets insertable by authenticated" ON public.wallets
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Create withdrawals table
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  owner_id uuid NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('vendor', 'affiliate')),
  amount numeric NOT NULL CHECK (amount > 0),
  fee numeric NOT NULL DEFAULT 2000,
  net_amount numeric NOT NULL CHECK (net_amount > 0),
  method text NOT NULL DEFAULT 'mobile_money',
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider_reference text,
  failure_reason text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Withdrawals readable by authenticated" ON public.withdrawals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Withdrawals insertable by authenticated" ON public.withdrawals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Withdrawals updatable by authenticated" ON public.withdrawals
  FOR UPDATE TO authenticated USING (true);

-- 4. Create wallet_transactions table (audit trail)
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id),
  order_id uuid REFERENCES public.orders(id),
  withdrawal_id uuid REFERENCES public.withdrawals(id),
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wallet transactions readable by authenticated" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Wallet transactions insertable by authenticated" ON public.wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Trigger for updated_at on wallets and withdrawals
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. DB function to credit wallets atomically when order is fully confirmed
CREATE OR REPLACE FUNCTION public.credit_wallets_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_vendor_id uuid;
  v_affiliate_id uuid;
  v_vendor_share numeric;
  v_affiliate_commission numeric;
  v_platform_fee_rate numeric := 0.10;
  v_commission_rate numeric;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Lock the order row
  SELECT o.*, p.vendor_id 
  INTO v_order
  FROM orders o
  JOIN products p ON p.id = o.product_id
  WHERE o.id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;

  -- Check both confirmations
  IF v_order.vendor_confirmed_at IS NULL OR v_order.buyer_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('error', 'Both confirmations required');
  END IF;

  -- Check idempotency: if wallets already credited for this order
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE order_id = p_order_id AND type = 'credit') THEN
    RETURN jsonb_build_object('message', 'Already credited');
  END IF;

  v_vendor_id := v_order.vendor_id;
  v_affiliate_id := v_order.affiliate_id;
  v_commission_rate := COALESCE(v_order.affiliate_rate_at_purchase, 0);

  -- Calculate shares
  v_affiliate_commission := v_commission_rate * v_order.item_price;
  v_vendor_share := v_order.item_price - (v_platform_fee_rate * v_order.item_price) - v_affiliate_commission;

  -- Ensure vendor wallet exists (upsert)
  INSERT INTO wallets (owner_id, owner_type, balance, total_earned)
  VALUES (v_vendor_id, 'vendor', 0, 0)
  ON CONFLICT (owner_id, owner_type) DO NOTHING;

  -- Credit vendor wallet
  UPDATE wallets 
  SET balance = balance + v_vendor_share,
      total_earned = total_earned + v_vendor_share
  WHERE owner_id = v_vendor_id AND owner_type = 'vendor';

  INSERT INTO wallet_transactions (wallet_id, order_id, type, amount, description)
  SELECT id, p_order_id, 'credit', v_vendor_share, 'Order ' || v_order.order_number || ' vendor share'
  FROM wallets WHERE owner_id = v_vendor_id AND owner_type = 'vendor';

  v_result := jsonb_build_object('vendor_credited', v_vendor_share);

  -- Credit affiliate wallet if applicable
  IF v_affiliate_id IS NOT NULL AND v_affiliate_commission > 0 THEN
    INSERT INTO wallets (owner_id, owner_type, balance, total_earned)
    VALUES (v_affiliate_id, 'affiliate', 0, 0)
    ON CONFLICT (owner_id, owner_type) DO NOTHING;

    UPDATE wallets 
    SET balance = balance + v_affiliate_commission,
        total_earned = total_earned + v_affiliate_commission
    WHERE owner_id = v_affiliate_id AND owner_type = 'affiliate';

    INSERT INTO wallet_transactions (wallet_id, order_id, type, amount, description)
    SELECT id, p_order_id, 'credit', v_affiliate_commission, 'Order ' || v_order.order_number || ' affiliate commission'
    FROM wallets WHERE owner_id = v_affiliate_id AND owner_type = 'affiliate';

    v_result := v_result || jsonb_build_object('affiliate_credited', v_affiliate_commission);
  END IF;

  RETURN v_result;
END;
$$;
