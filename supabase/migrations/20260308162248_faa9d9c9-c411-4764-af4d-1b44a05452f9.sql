
-- Fix credit_wallets_for_order: check payment_status = 'confirmed' before crediting
CREATE OR REPLACE FUNCTION public.credit_wallets_for_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- CRITICAL: Check payment is confirmed before crediting wallets
  IF v_order.payment_status != 'confirmed' THEN
    RETURN jsonb_build_object('error', 'Payment not confirmed');
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

  -- For marketplace orders with commission but no affiliate, credit platform
  IF v_affiliate_id IS NULL AND v_affiliate_commission > 0 THEN
    v_result := v_result || jsonb_build_object('platform_commission', v_affiliate_commission);
  END IF;

  RETURN v_result;
END;
$function$;

-- Add unique constraint on order_number to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
  END IF;
END $$;
