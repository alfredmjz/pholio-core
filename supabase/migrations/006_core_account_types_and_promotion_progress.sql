-- ============================================================================
-- MIGRATION: 006_core_account_types_and_promotion_progress.sql
-- Finalises the account-type model for issue #99 and moves promotion progress
-- into the database.
--
-- NON-DESTRUCTIVE BY DESIGN:
--   * every statement is additive and idempotent (safe to re-run)
--   * no row is ever deleted - legacy and custom types are retired with
--     is_active = false so existing accounts keep a valid foreign key
--   * existing accounts are never re-assigned automatically; the owner picks a
--     new type through the guided migration dialog (user-controlled typing)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Stable machine key for account types
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_types ADD COLUMN IF NOT EXISTS code TEXT;
CREATE INDEX IF NOT EXISTS idx_account_types_code ON public.account_types(code);

-- ---------------------------------------------------------------------------
-- 2. Ensure the eight core types exist (never touches user-created rows)
-- ---------------------------------------------------------------------------
INSERT INTO public.account_types (user_id, name, class, category, is_tax_advantaged, icon, sort_order, is_system, code, is_active)
SELECT v.user_id, v.name, v.class, v.category, v.is_tax_advantaged, v.icon, v.sort_order, v.is_system, v.code, v.is_active
FROM (VALUES
    (NULL::uuid, 'Chequing',       'asset'::text,     'banking'::text,    false, 'wallet'::text,       1, true, 'chequing'::text,       true),
    (NULL::uuid, 'Savings',        'asset'::text,     'banking'::text,    false, 'piggy-bank'::text,   2, true, 'savings'::text,        true),
    (NULL::uuid, 'Investment',     'asset'::text,     'investment'::text, false, 'trending-up'::text,  3, true, 'investment'::text,     true),
    (NULL::uuid, 'Credit Card',    'liability'::text, 'credit'::text,     false, 'credit-card'::text,  4, true, 'credit_card'::text,    true),
    (NULL::uuid, 'Line of Credit', 'liability'::text, 'credit'::text,     false, 'minus-circle'::text, 5, true, 'line_of_credit'::text, true),
    (NULL::uuid, 'Mortgage',       'liability'::text, 'debt'::text,       false, 'home'::text,         6, true, 'mortgage'::text,       true),
    (NULL::uuid, 'Loans',          'liability'::text, 'debt'::text,       false, 'file-text'::text,    7, true, 'loan'::text,           true),
    (NULL::uuid, 'Other (Asset)',     'asset'::text,     'other'::text,      false, 'circle-help'::text,  8, true, 'other'::text,          true),
    (NULL::uuid, 'Other (Liability)', 'liability'::text, 'other'::text,      false, 'circle-help'::text,  9, true, 'other'::text,          true)
) AS v(user_id, name, class, category, is_tax_advantaged, icon, sort_order, is_system, code, is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.account_types t WHERE t.user_id IS NULL AND t.name = v.name
);

-- ---------------------------------------------------------------------------
-- 3. Normalise the eight core rows (covers rows seeded by 002_finance.sql,
--    which had different names/sort orders and therefore no code yet)
-- ---------------------------------------------------------------------------
UPDATE public.account_types AS t SET
    class       = v.class,
    category    = v.category,
    icon        = v.icon,
    sort_order  = v.sort_order,
    code        = v.code,
    is_system   = true,
    is_active   = true
FROM (VALUES
    ('Chequing',       'asset',     'banking',    'wallet',       1, 'chequing'),
    ('Savings',        'asset',     'banking',    'piggy-bank',   2, 'savings'),
    ('Investment',     'asset',     'investment', 'trending-up',  3, 'investment'),
    ('Credit Card',    'liability', 'credit',     'credit-card',  4, 'credit_card'),
    ('Line of Credit', 'liability', 'credit',     'minus-circle', 5, 'line_of_credit'),
    ('Mortgage',       'liability', 'debt',       'home',         6, 'mortgage'),
    ('Loans',          'liability', 'debt',       'file-text',    7, 'loan'),
    ('Other (Asset)',     'asset',     'other',      'circle-help',  8, 'other'),
    ('Other (Liability)', 'liability', 'other',      'circle-help',  9, 'other')
) AS v(name, class, category, icon, sort_order, code)
WHERE t.user_id IS NULL AND t.name = v.name;

-- ---------------------------------------------------------------------------
-- 4. Retire (never delete) legacy system types and all user-created types.
--    getAccountTypes() filters is_active = true, so only the eight core types
--    are offered from now on; accounts still referencing a retired row keep
--    working until the owner re-selects a type in the migration dialog.
-- ---------------------------------------------------------------------------
UPDATE public.account_types
SET is_active = false
WHERE user_id IS NULL
  AND name NOT IN ('Chequing', 'Savings', 'Investment', 'Credit Card', 'Line of Credit', 'Mortgage', 'Loans', 'Other (Asset)', 'Other (Liability)');

UPDATE public.account_types
SET is_active = false
WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Per-account field configuration for the fully-customisable "Other" type
-- ---------------------------------------------------------------------------
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS field_visibility JSONB;

-- ---------------------------------------------------------------------------
-- 6. Promotions: grants + database-maintained progress
-- ---------------------------------------------------------------------------
GRANT ALL ON public.account_promotions TO authenticated;

-- Recomputes current_amount / is_completed for every open promotion on an account.
-- Early-exits when the account has no open promotions, so ordinary ledger writes
-- cost effectively nothing.
--
-- Thresholds are direction-aware. The sign of account_transactions.amount depends on
-- the account class, so "money in" and "money out" are decided per class:
--   * asset     : money in = amount > 0 ; money out = amount < 0
--   * liability : money in = amount < 0 (debt paid down); money out = amount > 0
-- This keeps spend and deposit thresholds mutually exclusive.
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

-- One-time backfill for promotions that already exist.
DO $$
DECLARE
    v_account UUID;
BEGIN
    FOR v_account IN SELECT DISTINCT account_id FROM public.account_promotions WHERE is_completed = false
    LOOP
        PERFORM public.recalculate_account_promotions(v_account);
    END LOOP;
END $$;

