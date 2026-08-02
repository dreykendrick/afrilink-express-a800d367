-- affiliates
DROP POLICY IF EXISTS "Active affiliates are publicly readable" ON public.affiliates;
REVOKE ALL ON public.affiliates FROM anon, authenticated;
GRANT ALL ON public.affiliates TO service_role;

-- vendors
DROP POLICY IF EXISTS "Vendors readable for joins" ON public.vendors;
REVOKE ALL ON public.vendors FROM anon, authenticated;
GRANT ALL ON public.vendors TO service_role;

-- orders
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Orders can be updated" ON public.orders;
DROP POLICY IF EXISTS "Orders readable by order number" ON public.orders;
REVOKE ALL ON public.orders FROM anon, authenticated;
GRANT ALL ON public.orders TO service_role;

-- order_ledger
DROP POLICY IF EXISTS "Ledger insertable by authenticated" ON public.order_ledger;
DROP POLICY IF EXISTS "Ledger readable by authenticated" ON public.order_ledger;
DROP POLICY IF EXISTS "Ledger updatable by authenticated" ON public.order_ledger;
REVOKE ALL ON public.order_ledger FROM anon, authenticated;
GRANT ALL ON public.order_ledger TO service_role;

-- payout_accounts
DROP POLICY IF EXISTS "Payout accounts insertable by service role" ON public.payout_accounts;
DROP POLICY IF EXISTS "Payout accounts readable by service role" ON public.payout_accounts;
DROP POLICY IF EXISTS "Payout accounts updatable by service role" ON public.payout_accounts;
REVOKE ALL ON public.payout_accounts FROM anon, authenticated;
GRANT ALL ON public.payout_accounts TO service_role;

-- payout_settings
DROP POLICY IF EXISTS "Payout settings insertable by authenticated" ON public.payout_settings;
DROP POLICY IF EXISTS "Payout settings readable by authenticated" ON public.payout_settings;
DROP POLICY IF EXISTS "Payout settings updatable by authenticated" ON public.payout_settings;
REVOKE ALL ON public.payout_settings FROM anon, authenticated;
GRANT ALL ON public.payout_settings TO service_role;

-- payouts
DROP POLICY IF EXISTS "Payouts insertable by authenticated" ON public.payouts;
DROP POLICY IF EXISTS "Payouts readable by authenticated" ON public.payouts;
DROP POLICY IF EXISTS "Payouts updatable by authenticated" ON public.payouts;
REVOKE ALL ON public.payouts FROM anon, authenticated;
GRANT ALL ON public.payouts TO service_role;

-- wallets
DROP POLICY IF EXISTS "Wallets insertable by authenticated" ON public.wallets;
DROP POLICY IF EXISTS "Wallets readable by authenticated" ON public.wallets;
DROP POLICY IF EXISTS "Wallets updatable by authenticated" ON public.wallets;
REVOKE ALL ON public.wallets FROM anon, authenticated;
GRANT ALL ON public.wallets TO service_role;

-- withdrawals
DROP POLICY IF EXISTS "Withdrawals insertable by authenticated" ON public.withdrawals;
DROP POLICY IF EXISTS "Withdrawals readable by authenticated" ON public.withdrawals;
DROP POLICY IF EXISTS "Withdrawals updatable by authenticated" ON public.withdrawals;
REVOKE ALL ON public.withdrawals FROM anon, authenticated;
GRANT ALL ON public.withdrawals TO service_role;

-- functions: fixed search_path + no public execute
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_wallets_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallets_for_order(uuid) TO service_role;