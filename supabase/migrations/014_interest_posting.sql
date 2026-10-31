-- =============================================================================
-- Interest posting fixes
--
-- 1. Rates hold up to 6 decimals as a fraction (4.125% = 0.04125). DECIMAL(5,4) rounded mortgage
--    rates such as 4.125% to 4.13%. Widening keeps every stored value and is safe to re-run.
-- 2. The monthly interest job tags each row it posts with the month it pays (interest_period, the
--    1st of that month). The unique index allows one such row per account per month, so a retried
--    or repeated run cannot post interest twice. Interest rows entered by hand leave it NULL.
-- Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.accounts ALTER COLUMN interest_rate TYPE DECIMAL(9, 6);
ALTER TABLE public.accounts ALTER COLUMN overdraft_interest_rate TYPE DECIMAL(9, 6);

ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS interest_period DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_transactions_interest_period
    ON public.account_transactions(account_id, interest_period)
    WHERE interest_period IS NOT NULL;

COMMENT ON COLUMN public.account_transactions.interest_period IS 'First day of the month the interest job paid with this row; NULL for every other row';
