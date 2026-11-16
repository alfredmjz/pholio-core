-- =============================================================================
-- A recurring bill can pay down a debt
--
-- recurring_expenses.to_account_id on a bill is the debt it pays down: a credit card, line of
-- credit, loan or mortgage. Each payment is still a budget expense in the bill's category, so a
-- mortgage or loan payment counts in the budget. It also posts two ledger legs, like a transfer: a
-- 'payment' out of the paid-from account (an 'adjustment' that draws a liability) and a 'payment'
-- on the debt that lowers what is owed. With no paid-from account, only the debt leg posts.
--
-- Re-creates post_recurring_payment_to_account (010), delete_unified_transaction (004) and
-- update_unified_transaction (019) so the debt leg is posted, reversed and edited with its bill.
-- Subscriptions and transfers are unchanged. Additive and safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.post_recurring_payment_to_account() RETURNS TRIGGER AS $$
DECLARE
    v_account_id UUID;
    v_is_asset BOOLEAN;
    v_debt_id UUID;
    v_debt_is_asset BOOLEAN;
    v_amount DECIMAL(15, 2);
    v_debt_amount DECIMAL(15, 2);
    v_ledger_id UUID;
    v_debt_tx_id UUID;
BEGIN
    IF NEW.recurring_expense_id IS NULL OR NEW.linked_account_transaction_id IS NOT NULL OR NEW.source = 'transfer' THEN
        RETURN NULL;
    END IF;

    SELECT a.id, (t.class = 'asset') INTO v_account_id, v_is_asset
    FROM public.recurring_expenses r
    JOIN public.accounts a ON a.id = r.account_id AND a.user_id = NEW.user_id AND a.is_active
    JOIN public.account_types t ON t.id = a.account_type_id
    WHERE r.id = NEW.recurring_expense_id AND r.user_id = NEW.user_id;

    SELECT d.id, (dt.class = 'asset') INTO v_debt_id, v_debt_is_asset
    FROM public.recurring_expenses r
    JOIN public.accounts d ON d.id = r.to_account_id AND d.user_id = NEW.user_id AND d.is_active
    JOIN public.account_types dt ON dt.id = d.account_type_id AND dt.class = 'liability'
    WHERE r.id = NEW.recurring_expense_id AND r.user_id = NEW.user_id AND r.category = 'bill'
      AND d.id IS DISTINCT FROM v_account_id;

    IF v_account_id IS NULL AND v_debt_id IS NULL THEN RETURN NULL; END IF;

    IF v_account_id IS NOT NULL THEN
        v_amount := CASE WHEN v_is_asset THEN -ABS(NEW.amount) ELSE ABS(NEW.amount) END;
        INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
        VALUES (
            NEW.user_id, v_account_id, v_amount,
            CASE WHEN NOT v_is_asset THEN 'adjustment' WHEN v_debt_id IS NOT NULL THEN 'payment' ELSE 'withdrawal' END,
            NEW.name, NEW.transaction_date, NEW.id
        )
        RETURNING id INTO v_ledger_id;
        UPDATE public.accounts SET current_balance = current_balance + v_amount WHERE id = v_account_id;
        UPDATE public.transactions SET linked_account_transaction_id = v_ledger_id WHERE id = NEW.id;
    END IF;

    IF v_debt_id IS NOT NULL THEN
        v_debt_amount := -ABS(NEW.amount);
        INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id, linked_transfer_transaction_id)
        VALUES (NEW.user_id, v_debt_id, v_debt_amount, 'payment', NEW.name, NEW.transaction_date, NEW.id, v_ledger_id)
        RETURNING id INTO v_debt_tx_id;
        UPDATE public.accounts SET current_balance = current_balance + v_debt_amount WHERE id = v_debt_id;
        IF v_ledger_id IS NOT NULL THEN
            UPDATE public.account_transactions SET linked_transfer_transaction_id = v_debt_tx_id WHERE id = v_ledger_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Every leg linked to the budget row is reversed and deleted: a transfer's two legs, or a bill's
-- paid-from leg and its debt leg.
CREATE OR REPLACE FUNCTION public.delete_unified_transaction(p_transaction_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_linked_tx_id UUID;
    v_leg RECORD;
BEGIN
    SELECT linked_account_transaction_id INTO v_linked_tx_id FROM public.transactions WHERE id = p_transaction_id AND user_id = auth.uid();
    IF NOT FOUND THEN RETURN FALSE; END IF;

    UPDATE public.transactions SET linked_account_transaction_id = NULL WHERE id = p_transaction_id;

    FOR v_leg IN
        SELECT id, account_id, amount FROM public.account_transactions
        WHERE id = v_linked_tx_id
           OR (linked_allocation_transaction_id = p_transaction_id AND user_id = auth.uid())
    LOOP
        IF v_leg.account_id IS NOT NULL THEN
            UPDATE public.accounts SET current_balance = current_balance - v_leg.amount WHERE id = v_leg.account_id;
        END IF;
        DELETE FROM public.account_transactions WHERE id = v_leg.id;
    END LOOP;

    DELETE FROM public.transactions WHERE id = p_transaction_id;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Same as 019, except an expense keeps its debt leg in step (amount, date, name) while it still
-- has one and the paid-from account is not that debt.
CREATE OR REPLACE FUNCTION public.update_unified_transaction(p_transaction_id UUID, p_input JSONB) RETURNS BOOLEAN AS $$
DECLARE
    v_old_linked_tx_id UUID; v_old_account_id UUID; v_old_amount DECIMAL(15, 2); v_old_tx_type TEXT; v_old_source TEXT; v_old_budget_amount DECIMAL(15, 2); v_old_intent TEXT;
    v_old_to_tx_id UUID; v_old_to_account_id UUID; v_old_to_amount DECIMAL(15, 2);
    v_new_account_id UUID; v_new_to_account_id UUID; v_new_amount DECIMAL(15, 2); v_new_description TEXT; v_new_date DATE; v_new_category_id UUID; v_new_type TEXT; v_new_notes TEXT; v_new_tx_type TEXT; v_new_source TEXT;
    v_is_asset BOOLEAN; v_to_is_asset BOOLEAN; v_abs_amount DECIMAL(15, 2); v_account_amount DECIMAL(15, 2); v_to_amount DECIMAL(15, 2);
    v_new_linked_tx_id UUID; v_from_tx_id UUID; v_to_tx_id UUID; v_tx_type TEXT; v_income_types TEXT[];
BEGIN
    SELECT linked_account_transaction_id, source, amount INTO v_old_linked_tx_id, v_old_source, v_old_budget_amount FROM public.transactions WHERE id = p_transaction_id AND user_id = auth.uid();
    IF NOT FOUND THEN RETURN FALSE; END IF;
    v_old_intent := CASE WHEN v_old_source = 'transfer' THEN 'transfer' WHEN v_old_budget_amount > 0 THEN 'income' WHEN v_old_budget_amount < 0 THEN 'expense' END;

    v_new_description := p_input->>'description'; v_new_amount := (p_input->>'amount')::DECIMAL; v_new_date := (p_input->>'date')::DATE;
    v_new_category_id := (p_input->>'categoryId')::UUID; v_new_type := p_input->>'type';
    v_new_notes := p_input->>'notes'; v_new_tx_type := NULLIF(p_input->>'transactionType', '');
    v_abs_amount := ABS(v_new_amount);

    IF v_old_linked_tx_id IS NOT NULL THEN
        SELECT account_id, amount, transaction_type INTO v_old_account_id, v_old_amount, v_old_tx_type FROM public.account_transactions WHERE id = v_old_linked_tx_id;
    END IF;

    -- The second leg: a transfer's destination or a bill's debt leg. The from-leg's partner, else any
    -- other row linked to the budget row.
    SELECT id, account_id, amount INTO v_old_to_tx_id, v_old_to_account_id, v_old_to_amount
    FROM public.account_transactions
    WHERE linked_allocation_transaction_id = p_transaction_id AND user_id = auth.uid()
      AND id <> COALESCE(v_old_linked_tx_id, '00000000-0000-0000-0000-000000000000'::UUID)
    ORDER BY (id = (SELECT linked_transfer_transaction_id FROM public.account_transactions WHERE id = v_old_linked_tx_id)) DESC NULLS LAST
    LIMIT 1;

    IF v_new_type = 'transfer' THEN
        v_new_account_id := COALESCE((p_input->>'fromAccountId')::UUID, (p_input->>'accountId')::UUID);
        v_new_to_account_id := COALESCE((p_input->>'toAccountId')::UUID, v_old_to_account_id);
        IF v_new_account_id IS NULL OR v_new_to_account_id IS NULL OR v_new_account_id = v_new_to_account_id THEN RETURN FALSE; END IF;
        v_new_amount := v_abs_amount;
        v_new_category_id := NULL;
        v_new_source := 'transfer';
    ELSE
        v_new_account_id := (p_input->>'accountId')::UUID;
        IF v_new_type = 'income' THEN v_new_amount := v_abs_amount; ELSE v_new_amount := -v_abs_amount; END IF;
        v_new_source := CASE WHEN v_old_source = 'transfer' THEN 'manual' ELSE v_old_source END;
    END IF;

    UPDATE public.transactions SET name = v_new_description, amount = v_new_amount, transaction_date = v_new_date, category_id = v_new_category_id, notes = v_new_notes, source = v_new_source, updated_at = NOW() WHERE id = p_transaction_id;

    -- Type and signed amount for the (from-)leg on the new account (same rules as calculateSignedDelta).
    IF v_new_account_id IS NOT NULL THEN
        SELECT (account_types.class = 'asset') INTO v_is_asset FROM public.accounts JOIN public.account_types ON accounts.account_type_id = account_types.id WHERE accounts.id = v_new_account_id;
        v_income_types := CASE WHEN v_is_asset THEN ARRAY['deposit', 'contribution', 'refund', 'interest'] ELSE ARRAY['payment', 'refund'] END;

        IF v_new_type = 'transfer' THEN
            v_tx_type := COALESCE(v_new_tx_type, 'transfer');
            v_account_amount := CASE WHEN v_is_asset THEN -v_abs_amount ELSE v_abs_amount END;
        ELSE
            v_tx_type := v_new_tx_type;
            IF v_tx_type IS NULL AND v_old_tx_type IS NOT NULL AND v_old_tx_type <> 'transfer' AND (
                (v_old_intent = v_new_type AND v_old_account_id = v_new_account_id)
                OR (v_old_tx_type = ANY (v_income_types)) = (v_new_type = 'income')
            ) THEN
                v_tx_type := v_old_tx_type;
            END IF;
            v_tx_type := COALESCE(v_tx_type, CASE
                WHEN v_new_type = 'income' THEN CASE WHEN v_is_asset THEN 'deposit' ELSE 'refund' END
                ELSE CASE WHEN v_is_asset THEN 'withdrawal' ELSE 'adjustment' END
            END);
            v_account_amount := CASE
                WHEN v_is_asset THEN CASE WHEN v_tx_type = ANY (v_income_types) THEN v_abs_amount ELSE -v_abs_amount END
                ELSE CASE WHEN v_tx_type = ANY (v_income_types) THEN -v_abs_amount ELSE v_abs_amount END
            END;
        END IF;
    END IF;

    IF COALESCE(v_old_account_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(v_new_account_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
        IF v_new_account_id IS NOT NULL AND v_old_linked_tx_id IS NOT NULL THEN
            UPDATE public.account_transactions SET amount = v_account_amount, transaction_type = v_tx_type, description = v_new_description, transaction_date = v_new_date WHERE id = v_old_linked_tx_id;
            UPDATE public.accounts SET current_balance = current_balance - v_old_amount + v_account_amount WHERE id = v_new_account_id;
            v_from_tx_id := v_old_linked_tx_id;
        END IF;
    ELSE
        IF v_old_linked_tx_id IS NOT NULL THEN
            UPDATE public.accounts SET current_balance = current_balance - v_old_amount WHERE id = v_old_account_id;
            UPDATE public.transactions SET linked_account_transaction_id = NULL WHERE id = p_transaction_id;
            DELETE FROM public.account_transactions WHERE id = v_old_linked_tx_id;
        END IF;
        IF v_new_account_id IS NOT NULL THEN
            INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
            VALUES (auth.uid(), v_new_account_id, v_account_amount, v_tx_type, v_new_description, v_new_date, p_transaction_id) RETURNING id INTO v_new_linked_tx_id;
            UPDATE public.transactions SET linked_account_transaction_id = v_new_linked_tx_id WHERE id = p_transaction_id;
            UPDATE public.accounts SET current_balance = current_balance + v_account_amount WHERE id = v_new_account_id;
            v_from_tx_id := v_new_linked_tx_id;
        END IF;
    END IF;

    -- Destination leg: kept, moved or created for a transfer; removed when the row stops being one.
    IF v_new_type = 'transfer' THEN
        SELECT (account_types.class = 'asset') INTO v_to_is_asset FROM public.accounts JOIN public.account_types ON accounts.account_type_id = account_types.id WHERE accounts.id = v_new_to_account_id;
        v_to_amount := CASE WHEN v_to_is_asset THEN v_abs_amount ELSE -v_abs_amount END;

        IF v_old_to_tx_id IS NOT NULL AND v_old_to_account_id = v_new_to_account_id THEN
            UPDATE public.account_transactions SET amount = v_to_amount, transaction_type = CASE WHEN v_to_is_asset THEN 'transfer' ELSE 'payment' END, description = v_new_description, transaction_date = v_new_date WHERE id = v_old_to_tx_id;
            UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount + v_to_amount WHERE id = v_new_to_account_id;
            v_to_tx_id := v_old_to_tx_id;
        ELSE
            IF v_old_to_tx_id IS NOT NULL THEN
                UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount WHERE id = v_old_to_account_id;
                DELETE FROM public.account_transactions WHERE id = v_old_to_tx_id;
            END IF;
            INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
            VALUES (auth.uid(), v_new_to_account_id, v_to_amount, CASE WHEN v_to_is_asset THEN 'transfer' ELSE 'payment' END, v_new_description, v_new_date, p_transaction_id) RETURNING id INTO v_to_tx_id;
            UPDATE public.accounts SET current_balance = current_balance + v_to_amount WHERE id = v_new_to_account_id;
        END IF;

        UPDATE public.account_transactions SET linked_transfer_transaction_id = v_to_tx_id WHERE id = v_from_tx_id;
        UPDATE public.account_transactions SET linked_transfer_transaction_id = v_from_tx_id WHERE id = v_to_tx_id;
    ELSIF v_old_to_tx_id IS NOT NULL AND v_old_source <> 'transfer' AND v_new_type = 'expense'
          AND v_new_account_id IS DISTINCT FROM v_old_to_account_id THEN
        v_to_amount := -v_abs_amount;
        UPDATE public.account_transactions SET amount = v_to_amount, description = v_new_description, transaction_date = v_new_date, linked_transfer_transaction_id = v_from_tx_id WHERE id = v_old_to_tx_id;
        UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount + v_to_amount WHERE id = v_old_to_account_id;
        UPDATE public.account_transactions SET linked_transfer_transaction_id = v_old_to_tx_id WHERE id = v_from_tx_id;
    ELSIF v_old_to_tx_id IS NOT NULL THEN
        UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount WHERE id = v_old_to_account_id;
        DELETE FROM public.account_transactions WHERE id = v_old_to_tx_id;
        UPDATE public.account_transactions SET linked_transfer_transaction_id = NULL WHERE id = v_from_tx_id;
    END IF;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
