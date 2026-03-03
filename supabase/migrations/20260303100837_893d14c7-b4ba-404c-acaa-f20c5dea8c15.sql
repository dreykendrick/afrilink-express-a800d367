
-- Payout accounts for vendors/affiliates
CREATE TABLE public.payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('vendor', 'affiliate')),
  account_type text NOT NULL DEFAULT 'mobile_money' CHECK (account_type IN ('mobile_money', 'bank')),
  provider text,
  account_number text NOT NULL,
  account_name text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payout accounts readable by service role"
  ON public.payout_accounts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Payout accounts insertable by service role"
  ON public.payout_accounts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Payout accounts updatable by service role"
  ON public.payout_accounts FOR UPDATE
  TO authenticated USING (true);

-- Payouts table
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('vendor', 'affiliate', 'platform')),
  payout_account_id uuid REFERENCES public.payout_accounts(id),
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  provider_reference text,
  notes text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payouts readable by authenticated"
  ON public.payouts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Payouts insertable by authenticated"
  ON public.payouts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Payouts updatable by authenticated"
  ON public.payouts FOR UPDATE
  TO authenticated USING (true);

-- Payout settings (single row for global config)
CREATE TABLE public.payout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  run_hour int NOT NULL DEFAULT 9,
  min_threshold numeric NOT NULL DEFAULT 5000,
  hold_days int NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payout settings readable by authenticated"
  ON public.payout_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Payout settings updatable by authenticated"
  ON public.payout_settings FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Payout settings insertable by authenticated"
  ON public.payout_settings FOR INSERT
  TO authenticated WITH CHECK (true);

-- Seed default payout settings
INSERT INTO public.payout_settings (enabled, frequency, run_hour, min_threshold, hold_days)
VALUES (false, 'weekly', 9, 5000, 3);

-- Link ledger entries to payouts
ALTER TABLE public.order_ledger ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.payouts(id);

-- Indexes
CREATE INDEX idx_payouts_recipient ON public.payouts (recipient_id, recipient_type);
CREATE INDEX idx_payouts_status ON public.payouts (status);
CREATE INDEX idx_payout_accounts_owner ON public.payout_accounts (owner_id, owner_type);
CREATE INDEX idx_order_ledger_payout ON public.order_ledger (payout_id);

-- Triggers for updated_at
CREATE TRIGGER update_payout_accounts_updated_at
  BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payout_settings_updated_at
  BEFORE UPDATE ON public.payout_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
