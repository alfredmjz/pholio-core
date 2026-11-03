-- =============================================================================
-- Recurring transfers between the user's own accounts (#100)
--
-- A recurring item with category 'transfer' moves money from account_id to to_account_id on a
-- schedule. Each occurrence is one budget row (source 'transfer', +ABS, no category,
-- recurring_expense_id set); the AFTER INSERT trigger below gives it the two linked ledger legs
-- createUnifiedTransaction writes for a manual transfer, so update_unified_transaction and
-- delete_unified_transaction edit and reverse both legs. It posts whatever the balance, like a
-- bill on auto-pay; the fee triggers in 012 still apply.
--
-- Deleting either account clears its link and the transfer stops posting until both are picked
-- again. The function runs as the caller (not SECURITY DEFINER) and only posts between two
-- different active accounts the row's owner holds. Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_to_account_id ON public.recurring_expenses(to_account_id);

ALTER TABLE public.recurring_expenses DROP CONSTRAINT IF EXISTS recurring_expenses_category_check;
ALTER TABLE public.recurring_expenses ADD CONSTRAINT recurring_expenses_category_check CHECK (category IN ('subscription', 'bill', 'transfer'));

-- Signs follow calculateSignedDelta for a transfer: the source leg is -ABS on an asset and +ABS on
-- a liability; the destination leg is the opposite.
CREATE OR REPLACE FUNCTION public.post_recurring_transfer_to_accounts() RETURNS TRIGGER AS $$
DECLARE
    v_from_id UUID;
    v_to_id UUID;
    v_from_is_asset BOOLEAN;
    v_to_is_asset BOOLEAN;
    v_from_amount DECIMAL(15, 2);
    v_to_amount DECIMAL(15, 2);
    v_from_tx_id UUID;
    v_to_tx_id UUID;
BEGIN
    IF NEW.recurring_expense_id IS NULL OR NEW.linked_account_transaction_id IS NOT NULL OR NEW.source IS DISTINCT FROM 'transfer' THEN
        RETURN NULL;
    END IF;

    SELECT f.id, (ft.class = 'asset'), t.id, (tt.class = 'asset')
    INTO v_from_id, v_from_is_asset, v_to_id, v_to_is_asset
    FROM public.recurring_expenses r
    JOIN public.accounts f ON f.id = r.account_id AND f.user_id = NEW.user_id AND f.is_active
    JOIN public.account_types ft ON ft.id = f.account_type_id
    JOIN public.accounts t ON t.id = r.to_account_id AND t.user_id = NEW.user_id AND t.is_active
    JOIN public.account_types tt ON tt.id = t.account_type_id
    WHERE r.id = NEW.recurring_expense_id AND r.user_id = NEW.user_id AND r.category = 'transfer' AND f.id <> t.id;

    IF v_from_id IS NULL THEN RETURN NULL; END IF;

    v_from_amount := CASE WHEN v_from_is_asset THEN -ABS(NEW.amount) ELSE ABS(NEW.amount) END;
    v_to_amount := CASE WHEN v_to_is_asset THEN ABS(NEW.amount) ELSE -ABS(NEW.amount) END;

    INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
    VALUES (NEW.user_id, v_from_id, v_from_amount, 'transfer', NEW.name, NEW.transaction_date, NEW.id)
    RETURNING id INTO v_from_tx_id;
    UPDATE public.accounts SET current_balance = current_balance + v_from_amount WHERE id = v_from_id;

    INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id, linked_transfer_transaction_id)
    VALUES (NEW.user_id, v_to_id, v_to_amount, 'transfer', NEW.name, NEW.transaction_date, NEW.id, v_from_tx_id)
    RETURNING id INTO v_to_tx_id;
    UPDATE public.accounts SET current_balance = current_balance + v_to_amount WHERE id = v_to_id;

    UPDATE public.account_transactions SET linked_transfer_transaction_id = v_to_tx_id WHERE id = v_from_tx_id;
    UPDATE public.transactions SET linked_account_transaction_id = v_from_tx_id WHERE id = NEW.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS post_recurring_transfer_to_accounts_trigger ON public.transactions;
CREATE TRIGGER post_recurring_transfer_to_accounts_trigger
    AFTER INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.post_recurring_transfer_to_accounts();
