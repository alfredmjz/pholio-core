-- =============================================================================
-- Debt payments are transfers into a liability
--
-- A transfer into a credit card, line of credit, loan or mortgage pays down its debt. Its leg on
-- that account is now a 'payment' row (the paying leg stays 'transfer'), so the account's
-- activity says Payment. The budget row is unchanged (source 'transfer', +ABS, no category), so a
-- payment never counts as spending and net worth does not move.
--
-- Re-creates update_unified_transaction (004) and the recurring transfer trigger (016) with that
-- leg type; createTransfer in src/lib/domain/transactions.ts writes the same. Safe to re-run.
-- =============================================================================

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

    -- The destination leg of an existing transfer: the from-leg's partner, else any other row linked to the budget row.
    SELECT id, account_id, amount INTO v_old_to_tx_id, v_old_to_account_id, v_old_to_amount
    FROM public.account_transactions
    WHERE v_old_source = 'transfer' AND linked_allocation_transaction_id = p_transaction_id AND user_id = auth.uid()
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
                WHEN v_new_type = 'income' THEN CASE WHEN v_is_asset THEN 'deposit' ELSE 'payment' END
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
    ELSIF v_old_to_tx_id IS NOT NULL THEN
        UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount WHERE id = v_old_to_account_id;
        DELETE FROM public.account_transactions WHERE id = v_old_to_tx_id;
        UPDATE public.account_transactions SET linked_transfer_transaction_id = NULL WHERE id = v_from_tx_id;
    END IF;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
    VALUES (NEW.user_id, v_to_id, v_to_amount, CASE WHEN v_to_is_asset THEN 'transfer' ELSE 'payment' END, NEW.name, NEW.transaction_date, NEW.id, v_from_tx_id)
    RETURNING id INTO v_to_tx_id;
    UPDATE public.accounts SET current_balance = current_balance + v_to_amount WHERE id = v_to_id;

    UPDATE public.account_transactions SET linked_transfer_transaction_id = v_to_tx_id WHERE id = v_from_tx_id;
    UPDATE public.transactions SET linked_account_transaction_id = v_from_tx_id WHERE id = NEW.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;
