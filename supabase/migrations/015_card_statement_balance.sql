-- =============================================================================
-- Credit card statement balance
--
-- A card added or updated partway through a statement has a current balance that differs from
-- what its last statement said, and the ledger can't reach back far enough to tell the two apart.
-- The owner can enter the statement balance; statement_balance_date is the close date of the
-- statement it belongs to. src/lib/credit-card-statement.ts uses it for that statement only and
-- works later statements back from the ledger as before.
-- Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS statement_balance DECIMAL(15,2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS statement_balance_date DATE;

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS statement_balance_has_date;
ALTER TABLE public.accounts ADD CONSTRAINT statement_balance_has_date
	CHECK ((statement_balance IS NULL) = (statement_balance_date IS NULL));

COMMENT ON COLUMN public.accounts.statement_balance IS 'Statement balance the owner entered; NULL = worked back from current_balance and the ledger';
COMMENT ON COLUMN public.accounts.statement_balance_date IS 'Close date of the statement statement_balance belongs to';
