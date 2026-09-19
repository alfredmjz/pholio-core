-- ============================================================================
-- MIGRATION: 005_promotions_and_account_types.sql
-- Streamline system account types to 7 core types & add account_promotions
-- ============================================================================

-- 0. Ensure recurring_transfers table exists (added in 002_finance.sql but
--    may be missing from existing databases deployed before that revision).
CREATE TABLE IF NOT EXISTS public.recurring_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    source_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    destination_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    billing_period TEXT NOT NULL,
    next_transfer_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT source_dest_different CHECK (source_account_id <> destination_account_id)
);

ALTER TABLE public.recurring_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own recurring transfers" ON public.recurring_transfers;
CREATE POLICY "Users can manage own recurring transfers" ON public.recurring_transfers FOR ALL USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_recurring_transfers_updated_at ON public.recurring_transfers;
CREATE TRIGGER update_recurring_transfers_updated_at BEFORE UPDATE ON public.recurring_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_recurring_transfers_user_id ON public.recurring_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transfers_is_active ON public.recurring_transfers(is_active);
GRANT ALL ON public.recurring_transfers TO authenticated;

-- Also ensure account_transactions has the recurring_transfer_id column if
-- the table already existed without it.
ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS recurring_transfer_id UUID REFERENCES public.recurring_transfers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_account_transactions_recurring_transfer_id ON public.account_transactions(recurring_transfer_id);

-- 1. Streamline system account types to 7 core types
INSERT INTO public.account_types (user_id, name, class, category, is_tax_advantaged, icon, sort_order, is_system) VALUES
    (NULL, 'Chequing', 'asset', 'banking', false, 'wallet', 1, true),
    (NULL, 'Savings', 'asset', 'banking', false, 'piggy-bank', 2, true),
    (NULL, 'Investment', 'asset', 'investment', false, 'trending-up', 3, true),
    (NULL, 'Credit Card', 'liability', 'credit', false, 'credit-card', 4, true),
    (NULL, 'Line of Credit', 'liability', 'credit', false, 'minus-circle', 5, true),
    (NULL, 'Mortgage', 'liability', 'debt', false, 'home', 6, true),
    (NULL, 'Loans', 'liability', 'debt', false, 'file-text', 7, true)
ON CONFLICT DO NOTHING;

-- 2. TABLE: account_promotions
CREATE TABLE IF NOT EXISTS public.account_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    promotion_type TEXT NOT NULL CHECK (promotion_type IN ('spend_threshold', 'deposit_threshold', 'maintaining_balance')),
    target_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    reward_description VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own account promotions" ON public.account_promotions;
CREATE POLICY "Users manage own account promotions" ON public.account_promotions FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS account_promotions_updated_at_trigger ON public.account_promotions;
CREATE TRIGGER account_promotions_updated_at_trigger BEFORE UPDATE ON public.account_promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_account_promotions_account ON public.account_promotions(account_id, end_date);
