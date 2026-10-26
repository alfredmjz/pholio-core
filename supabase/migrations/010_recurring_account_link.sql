-- =============================================================================
-- Recurring bills and subscriptions paid from an account (#106)
--
-- recurring_expenses.account_id is the account a bill or subscription is paid from; NULL means
-- no account. Deleting the account keeps the bill and clears the link.
--
-- Every payment of a linked bill posts to that account: the AFTER INSERT trigger below gives a
-- new recurring budget row its ledger row, moves the balance and links the two, the same shape
-- createUnifiedTransaction writes, so update_unified_transaction and delete_unified_transaction
-- edit and reverse it. It covers Mark paid, Pay ahead and auto-pay alike. Payments post whatever
-- the balance or credit limit: Pholio records the charge, the bank enforces the rules.
--
-- The function runs as the caller (not SECURITY DEFINER) and only posts to an active account the
-- row's owner holds, so RLS still applies. Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_account_id ON public.recurring_expenses(account_id);

-- Sign and type follow calculateSignedDelta for an expense: an asset gets a withdrawal (-amount),
-- a liability an adjustment (+amount, shown as a purchase because it has a budget row).
CREATE OR REPLACE FUNCTION public.post_recurring_payment_to_account() RETURNS TRIGGER AS $$
DECLARE
    v_account_id UUID;
    v_is_asset BOOLEAN;
    v_amount DECIMAL(15, 2);
    v_ledger_id UUID;
BEGIN
    IF NEW.recurring_expense_id IS NULL OR NEW.linked_account_transaction_id IS NOT NULL OR NEW.source = 'transfer' THEN
        RETURN NULL;
    END IF;

    SELECT a.id, (t.class = 'asset') INTO v_account_id, v_is_asset
    FROM public.recurring_expenses r
    JOIN public.accounts a ON a.id = r.account_id AND a.user_id = NEW.user_id AND a.is_active
    JOIN public.account_types t ON t.id = a.account_type_id
    WHERE r.id = NEW.recurring_expense_id AND r.user_id = NEW.user_id;

    IF v_account_id IS NULL THEN RETURN NULL; END IF;

    v_amount := CASE WHEN v_is_asset THEN -ABS(NEW.amount) ELSE ABS(NEW.amount) END;

    INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
    VALUES (NEW.user_id, v_account_id, v_amount, CASE WHEN v_is_asset THEN 'withdrawal' ELSE 'adjustment' END, NEW.name, NEW.transaction_date, NEW.id)
    RETURNING id INTO v_ledger_id;

    UPDATE public.accounts SET current_balance = current_balance + v_amount WHERE id = v_account_id;
    UPDATE public.transactions SET linked_account_transaction_id = v_ledger_id WHERE id = NEW.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS post_recurring_payment_to_account_trigger ON public.transactions;
CREATE TRIGGER post_recurring_payment_to_account_trigger
    AFTER INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.post_recurring_payment_to_account();
