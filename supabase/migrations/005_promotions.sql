-- Migration: 005_promotions
-- Description: Account promotions (spend / deposit / maintaining-balance reward goals) and their progress

-- ============================================================================
-- TABLE: account_promotions
-- ============================================================================

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

GRANT ALL ON public.account_promotions TO authenticated;

-- ============================================================================
-- FUNCTION: recalculate_account_promotions
-- ============================================================================

-- Recomputes every open promotion on an account; exits early when there are none.
-- Ledger signs depend on the account class, so money in / out is decided per class:
--   asset     : in = amount > 0 ; out = amount < 0
--   liability : in = amount < 0 (debt paid down) ; out = amount > 0
CREATE OR REPLACE FUNCTION public.recalculate_account_promotions(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_promo RECORD;
    v_progress DECIMAL(15, 2);
    v_balance DECIMAL(15, 2);
    v_is_asset BOOLEAN := true;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.account_promotions
        WHERE account_id = p_account_id AND is_completed = false
    ) THEN
        RETURN;
    END IF;

    SELECT COALESCE(MAX(current_balance), 0) INTO v_balance
    FROM public.accounts
    WHERE id = p_account_id;

    SELECT (at.class = 'asset') INTO v_is_asset
    FROM public.accounts a
    JOIN public.account_types at ON at.id = a.account_type_id
    WHERE a.id = p_account_id;

    FOR v_promo IN
        SELECT id, promotion_type, target_amount, start_date, end_date
        FROM public.account_promotions
        WHERE account_id = p_account_id AND is_completed = false
    LOOP
        IF v_promo.promotion_type = 'maintaining_balance' THEN
            v_progress := COALESCE(v_balance, 0);
        ELSIF v_promo.promotion_type = 'deposit_threshold' THEN
            SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_progress
            FROM public.account_transactions
            WHERE account_id = p_account_id
              AND transaction_date >= v_promo.start_date
              AND transaction_date <= v_promo.end_date
              AND ((v_is_asset AND amount > 0) OR (NOT v_is_asset AND amount < 0));
        ELSE
            SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_progress
            FROM public.account_transactions
            WHERE account_id = p_account_id
              AND transaction_date >= v_promo.start_date
              AND transaction_date <= v_promo.end_date
              AND ((v_is_asset AND amount < 0) OR (NOT v_is_asset AND amount > 0));
        END IF;

        UPDATE public.account_promotions
        SET current_amount = v_progress,
            is_completed   = v_progress >= target_amount,
            updated_at     = NOW()
        WHERE id = v_promo.id;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_account_promotions_recalc() RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_account_promotions(COALESCE(NEW.account_id, OLD.account_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS account_transactions_recalc_promotions ON public.account_transactions;
CREATE TRIGGER account_transactions_recalc_promotions
AFTER INSERT OR UPDATE OR DELETE ON public.account_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_account_promotions_recalc();
