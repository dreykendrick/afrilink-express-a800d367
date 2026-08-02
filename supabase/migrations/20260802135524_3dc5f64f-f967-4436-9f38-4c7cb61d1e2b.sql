DROP POLICY IF EXISTS "Anyone can create affiliate clicks" ON public.affiliate_clicks;
REVOKE ALL ON public.affiliate_clicks FROM anon, authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;

DROP POLICY IF EXISTS "Anyone can create order issues" ON public.order_issues;
REVOKE ALL ON public.order_issues FROM anon, authenticated;
GRANT ALL ON public.order_issues TO service_role;

DROP POLICY IF EXISTS "Wallet transactions insertable by authenticated" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Wallet transactions readable by authenticated" ON public.wallet_transactions;
REVOKE ALL ON public.wallet_transactions FROM anon, authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;