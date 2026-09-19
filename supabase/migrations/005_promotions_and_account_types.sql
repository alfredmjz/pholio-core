-- ============================================================================
-- MIGRATION: 005_promotions_and_account_types.sql
-- Account promotions table: spend / deposit / maintaining-balance reward goals.
--
-- NOTE: the core account types and the `recurring_transfers` /
-- `account_transactions.recurring_transfer_id` definitions live in earlier
-- migrations (002 and 003); this migration no longer duplicates them.
-- ============================================================================

-- TABLE: account_promotions
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
