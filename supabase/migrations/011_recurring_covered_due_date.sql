-- =============================================================================
-- Which due date a recurring payment covers (#106)
--
-- A bill paid early is recorded on the day it is paid, so its transaction_date is no longer the
-- due date it settles. transactions.covers_due_date keeps that due date; NULL (older rows and
-- non-recurring rows) means the transaction date. Bills count as paid by the due date covered,
-- so a month whose bill was prepaid shows it as paid.
--
-- sync_recurring_recorded_occurrence (003_budgeting.sql) now keys each marker on the covered
-- due date, so auto-pay never re-records a prepaid bill and editing the payment's date leaves
-- the bill it covers alone. Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS covers_due_date DATE;

CREATE OR REPLACE FUNCTION public.sync_recurring_recorded_occurrence()
RETURNS TRIGGER AS $$
DECLARE
    v_old_due DATE;
    v_new_due DATE;
BEGIN
    v_new_due := COALESCE(NEW.covers_due_date, NEW.transaction_date);

    IF TG_OP = 'INSERT' THEN
        IF NEW.recurring_expense_id IS NOT NULL THEN
            INSERT INTO public.recurring_recorded_occurrences (user_id, recurring_expense_id, occurrence_date, amount)
            VALUES (NEW.user_id, NEW.recurring_expense_id, v_new_due, NEW.amount)
            ON CONFLICT (user_id, recurring_expense_id, occurrence_date) DO UPDATE SET amount = EXCLUDED.amount;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: drop the old marker only when no other transaction still covers that due date.
    v_old_due := COALESCE(OLD.covers_due_date, OLD.transaction_date);
    IF OLD.recurring_expense_id IS NOT NULL
       AND (OLD.recurring_expense_id IS DISTINCT FROM NEW.recurring_expense_id OR v_old_due IS DISTINCT FROM v_new_due) THEN
        DELETE FROM public.recurring_recorded_occurrences m
        WHERE m.user_id = OLD.user_id
          AND m.recurring_expense_id = OLD.recurring_expense_id
          AND m.occurrence_date = v_old_due
          AND NOT EXISTS (
              SELECT 1 FROM public.transactions t
              WHERE t.user_id = OLD.user_id
                AND t.recurring_expense_id = OLD.recurring_expense_id
                AND COALESCE(t.covers_due_date, t.transaction_date) = v_old_due
                AND t.id <> OLD.id
          );
    END IF;

    IF NEW.recurring_expense_id IS NOT NULL THEN
        INSERT INTO public.recurring_recorded_occurrences (user_id, recurring_expense_id, occurrence_date, amount)
        VALUES (NEW.user_id, NEW.recurring_expense_id, v_new_due, NEW.amount)
        ON CONFLICT (user_id, recurring_expense_id, occurrence_date) DO UPDATE SET amount = EXCLUDED.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_recurring_recorded_occurrence_trigger ON public.transactions;
CREATE TRIGGER sync_recurring_recorded_occurrence_trigger
    AFTER INSERT OR UPDATE OF transaction_date, amount, recurring_expense_id, covers_due_date ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.sync_recurring_recorded_occurrence();
