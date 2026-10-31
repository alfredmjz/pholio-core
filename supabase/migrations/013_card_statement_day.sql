-- =============================================================================
-- Credit card statement day
--
-- The day of the month a card's statement closes. The statement balance is what was owed at
-- the close, worked back from current_balance and the ledger (src/lib/credit-card-statement.ts).
-- NULL means the statement closes 21 days before payment_due_date.
-- Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS statement_day SMALLINT;

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS valid_statement_day;
ALTER TABLE public.accounts ADD CONSTRAINT valid_statement_day CHECK (statement_day IS NULL OR (statement_day >= 1 AND statement_day <= 31));

COMMENT ON COLUMN public.accounts.statement_day IS 'Day of the month the card statement closes; NULL = 21 days before payment_due_date';
