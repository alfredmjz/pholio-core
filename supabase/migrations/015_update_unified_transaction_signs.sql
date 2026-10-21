-- Sign and type the ledger row of an edited transaction the way createUnifiedTransaction does.
--
-- The 004 version of update_unified_transaction always stored income as +ABS(amount), and on an
-- account change it always wrote 'deposit' or 'payment'. Liability balances are positive debt, so a
-- credit-card payment or refund (stored as -ABS on create) became +ABS when re-saved unchanged and
-- the debt went up by twice the amount. Moving a refund to another account turned it into a deposit
-- or payment.
--
-- The rules below mirror calculateSignedDelta / calculateTransactionDetails
-- (src/lib/account-validation-utils.ts, src/lib/actions/unified-transaction-actions.ts):
--   type:   transactionType from the input; otherwise the stored type when it still fits the intent
--           (the Allocations dialog does not send transactionType, and a refund must stay a refund);
--           otherwise deposit/payment for income and withdrawal/adjustment for expenses.
--   sign:   transfer -> asset -ABS, liability +ABS;
--           asset     -> deposit/contribution/refund/interest +ABS, everything else -ABS;
--           liability -> payment/refund -ABS, everything else +ABS.
--
-- CREATE OR REPLACE keeps the signature, owner and existing EXECUTE privileges, so re-running is safe.

CREATE OR REPLACE FUNCTION public.update_unified_transaction(p_transaction_id UUID, p_input JSONB) RETURNS BOOLEAN AS $$
DECLARE
    v_old_linked_tx_id UUID; v_old_account_id UUID; v_old_amount DECIMAL(15, 2); v_old_tx_type TEXT;
    v_new_account_id UUID; v_new_amount DECIMAL(15, 2); v_new_description TEXT; v_new_date DATE; v_new_category_id UUID; v_new_type TEXT; v_new_notes TEXT; v_new_tx_type TEXT;
    v_is_asset BOOLEAN; v_abs_amount DECIMAL(15, 2); v_account_amount DECIMAL(15, 2); v_new_linked_tx_id UUID; v_tx_type TEXT; v_income_types TEXT[];
BEGIN
    SELECT linked_account_transaction_id INTO v_old_linked_tx_id FROM public.transactions WHERE id = p_transaction_id AND user_id = auth.uid();
    IF NOT FOUND THEN RETURN FALSE; END IF;

    v_new_description := p_input->>'description'; v_new_amount := (p_input->>'amount')::DECIMAL; v_new_date := (p_input->>'date')::DATE;
    v_new_category_id := (p_input->>'categoryId')::UUID; v_new_account_id := (p_input->>'accountId')::UUID; v_new_type := p_input->>'type';
    v_new_notes := p_input->>'notes'; v_new_tx_type := NULLIF(p_input->>'transactionType', '');
    v_abs_amount := ABS(v_new_amount);

    IF v_new_type = 'income' THEN v_new_amount := v_abs_amount; ELSE v_new_amount := -v_abs_amount; END IF;

    IF v_old_linked_tx_id IS NOT NULL THEN
        SELECT account_id, amount, transaction_type INTO v_old_account_id, v_old_amount, v_old_tx_type FROM public.account_transactions WHERE id = v_old_linked_tx_id;
    END IF;

    UPDATE public.transactions SET name = v_new_description, amount = v_new_amount, transaction_date = v_new_date, category_id = v_new_category_id, notes = v_new_notes, updated_at = NOW() WHERE id = p_transaction_id;

    -- Type and signed amount for the ledger row on the new account (same rules as calculateSignedDelta).
    IF v_new_account_id IS NOT NULL THEN
        SELECT (account_types.class = 'asset') INTO v_is_asset FROM public.accounts JOIN public.account_types ON accounts.account_type_id = account_types.id WHERE accounts.id = v_new_account_id;
        v_income_types := CASE WHEN v_is_asset THEN ARRAY['deposit', 'contribution', 'refund', 'interest'] ELSE ARRAY['payment', 'refund'] END;

        IF v_new_type = 'transfer' THEN
            v_tx_type := COALESCE(v_new_tx_type, v_old_tx_type, CASE WHEN v_is_asset THEN 'withdrawal' ELSE 'adjustment' END);
            v_account_amount := CASE WHEN v_is_asset THEN -v_abs_amount ELSE v_abs_amount END;
        ELSE
            v_tx_type := v_new_tx_type;
            IF v_tx_type IS NULL AND v_old_tx_type IS NOT NULL AND v_old_tx_type <> 'transfer'
                AND (v_old_tx_type = ANY (v_income_types)) = (v_new_type = 'income') THEN
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
        END IF;
    END IF;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
