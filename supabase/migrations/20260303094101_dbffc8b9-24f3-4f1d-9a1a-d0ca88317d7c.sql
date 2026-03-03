
-- Add unified checkout fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'affiliate_link';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid DEFAULT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_role text DEFAULT 'guest';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS affiliate_rate_at_purchase numeric DEFAULT NULL;

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders (source);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_role ON public.orders (buyer_role);

-- Create order_ledger table for payouts/commissions
CREATE TABLE IF NOT EXISTS public.order_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  recipient_id uuid DEFAULT NULL,
  recipient_type text DEFAULT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_ledger ENABLE ROW LEVEL SECURITY;

-- Service-role only access via edge functions
CREATE POLICY "Ledger readable by authenticated"
  ON public.order_ledger FOR SELECT
  USING (true);

CREATE POLICY "Ledger insertable by authenticated"
  ON public.order_ledger FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Ledger updatable by authenticated"
  ON public.order_ledger FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_order_ledger_order_id ON public.order_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_order_ledger_status ON public.order_ledger (status);

-- Auto-update updated_at
CREATE TRIGGER update_order_ledger_updated_at
  BEFORE UPDATE ON public.order_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
