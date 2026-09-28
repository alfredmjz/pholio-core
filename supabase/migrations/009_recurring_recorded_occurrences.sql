-- Migration: 009_recurring_recorded_occurrences
-- Description: Track occurrences that have been recorded for recurring expenses.
--              Auto-pay only creates a transaction for an occurrence that has no
--              marker, so editing a bill never rewrites an already-recorded
--              transaction and deleting one never gets re-recorded.
--              Also re-links legacy recurring transactions that lost their
--              recurring_expense_id so they participate in tracking too.

-- ============================================================================
-- TABLE: recurring_recorded_occurrences
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_recorded_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recurring_expense_id UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, recurring_expense_id, occurrence_date)
);

ALTER TABLE public.recurring_recorded_occurrences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own recorded occurrences" ON public.recurring_recorded_occurrences;
CREATE POLICY "Users can manage own recorded occurrences" ON public.recurring_recorded_occurrences
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recurring_recorded_occurrences_user
    ON public.recurring_recorded_occurrences(user_id, recurring_expense_id, occurrence_date);

GRANT ALL ON public.recurring_recorded_occurrences TO authenticated;

-- ============================================================================
-- TRIGGER: keep recorded occurrences in sync with recurring transactions
--   - INSERT: record the occurrence (amount captured at record time).
--   - UPDATE (date/amount/expense): re-key the marker so it follows the
--     transaction when the user edits it.
--   - DELETE: intentionally not handled. The marker must survive deletion so
--     auto-pay does not re-record an occurrence the user removed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_recurring_recorded_occurrence()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.recurring_expense_id IS NOT NULL THEN
            INSERT INTO public.recurring_recorded_occurrences (user_id, recurring_expense_id, occurrence_date, amount)
            VALUES (NEW.user_id, NEW.recurring_expense_id, NEW.transaction_date, NEW.amount)
            ON CONFLICT (user_id, recurring_expense_id, occurrence_date) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: drop the old marker only when no transaction remains at the old date.
    IF OLD.recurring_expense_id IS NOT NULL
       AND (OLD.recurring_expense_id IS DISTINCT FROM NEW.recurring_expense_id
            OR OLD.transaction_date IS DISTINCT FROM NEW.transaction_date) THEN
        DELETE FROM public.recurring_recorded_occurrences m
        WHERE m.user_id = OLD.user_id
          AND m.recurring_expense_id = OLD.recurring_expense_id
          AND m.occurrence_date = OLD.transaction_date
          AND NOT EXISTS (
              SELECT 1 FROM public.transactions t
              WHERE t.user_id = OLD.user_id
                AND t.recurring_expense_id = OLD.recurring_expense_id
                AND t.transaction_date = OLD.transaction_date
                AND t.id <> OLD.id
          );
    END IF;

    IF NEW.recurring_expense_id IS NOT NULL THEN
        INSERT INTO public.recurring_recorded_occurrences (user_id, recurring_expense_id, occurrence_date, amount)
        VALUES (NEW.user_id, NEW.recurring_expense_id, NEW.transaction_date, NEW.amount)
        ON CONFLICT (user_id, recurring_expense_id, occurrence_date) DO UPDATE SET amount = EXCLUDED.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_recurring_recorded_occurrence_trigger ON public.transactions;
CREATE TRIGGER sync_recurring_recorded_occurrence_trigger
    AFTER INSERT OR UPDATE OF transaction_date, amount, recurring_expense_id ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.sync_recurring_recorded_occurrence();

-- ============================================================================
-- DATA REPAIR: link legacy recurring transactions to their recurring expense
-- when the name matches exactly one live expense for that user.
-- Idempotent: only touches rows with recurring_expense_id IS NULL.
-- ============================================================================

UPDATE public.transactions t
SET recurring_expense_id = re.id
FROM public.recurring_expenses re
WHERE t.recurring_expense_id IS NULL
  AND t.source = 'recurring'
  AND t.name IS NOT NULL
  AND t.user_id = re.user_id
  AND LOWER(t.name) = LOWER(re.name)
  AND (
      SELECT COUNT(DISTINCT re2.id)
      FROM public.recurring_expenses re2
      WHERE re2.user_id = t.user_id
        AND LOWER(re2.name) = LOWER(t.name)
  ) = 1;

-- ============================================================================
-- BACKFILL: mark every occurrence that already has a recorded transaction,
-- including the legacy rows linked above.
-- ============================================================================

INSERT INTO public.recurring_recorded_occurrences (user_id, recurring_expense_id, occurrence_date, amount)
SELECT DISTINCT ON (t.user_id, t.recurring_expense_id, t.transaction_date)
       t.user_id, t.recurring_expense_id, t.transaction_date, t.amount
FROM public.transactions t
WHERE t.recurring_expense_id IS NOT NULL
ORDER BY t.user_id, t.recurring_expense_id, t.transaction_date, t.created_at ASC
ON CONFLICT (user_id, recurring_expense_id, occurrence_date) DO NOTHING;
