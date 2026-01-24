-- Migration: 007_unified_transaction_rpc
-- Description: RPCs for atomic transaction handling (Delete and Update)

-- ==========================================
-- 1. DELETE UNIFIED TRANSACTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.delete_unified_transaction(
    p_transaction_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_linked_tx_id UUID;
    v_linked_account_id UUID;
    v_linked_amount DECIMAL(15, 2);
    v_current_balance DECIMAL(15, 2);
BEGIN
    -- 1. Get transaction details and verify ownership
    SELECT linked_account_transaction_id
    INTO v_linked_tx_id
    FROM public.transactions
    WHERE id = p_transaction_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        -- Transaction does not exist or does not belong to user
        RETURN FALSE;
    END IF;

    -- 2. If linked, handle account balance reversion
    IF v_linked_tx_id IS NOT NULL THEN
        SELECT account_id, amount
        INTO v_linked_account_id, v_linked_amount
        FROM public.account_transactions
        WHERE id = v_linked_tx_id;

        IF v_linked_account_id IS NOT NULL THEN
            -- Get current balance
            SELECT current_balance INTO v_current_balance
            FROM public.accounts
            WHERE id = v_linked_account_id;

            -- Revert balance (subtract the amount: -(-50) = +50)
            UPDATE public.accounts
            SET current_balance = v_current_balance - v_linked_amount
            WHERE id = v_linked_account_id;
        END IF;

        -- Break the circular link strictly before deletion
        UPDATE public.transactions
        SET linked_account_transaction_id = NULL
        WHERE id = p_transaction_id;

        -- Delete the account transaction
        DELETE FROM public.account_transactions
        WHERE id = v_linked_tx_id;
    END IF;

    -- 3. Delete the allocation transaction
    DELETE FROM public.transactions
    WHERE id = p_transaction_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. UPDATE UNIFIED TRANSACTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_unified_transaction(
    p_transaction_id UUID,
    p_input JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_linked_tx_id UUID;
    v_old_account_id UUID;
    v_old_amount DECIMAL(15, 2);

    v_new_account_id UUID;
    v_new_amount DECIMAL(15, 2);
    v_new_description TEXT;
    v_new_date DATE;
    v_new_category_id UUID;
    v_new_type TEXT;
    v_new_notes TEXT;
    v_new_tx_type TEXT;
    v_tx_type TEXT;

    v_is_asset BOOLEAN;
    v_account_amount DECIMAL(15, 2);
    v_new_linked_tx_id UUID;
BEGIN
    -- 1. Verify ownership and get existing link
    SELECT linked_account_transaction_id
    INTO v_old_linked_tx_id
    FROM public.transactions
    WHERE id = p_transaction_id AND user_id = auth.uid();

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Extract inputs from JSONB
    v_new_description := p_input->>'description';
    v_new_amount := (p_input->>'amount')::DECIMAL;
    v_new_date := (p_input->>'date')::DATE;
    v_new_category_id := (p_input->>'categoryId')::UUID;
    v_new_account_id := (p_input->>'accountId')::UUID;
    v_new_type := p_input->>'type';
    v_new_notes := p_input->>'notes';
    v_new_tx_type := p_input->>'transactionType';

    -- 3. Calculate signed budget amount
    IF v_new_type = 'income' THEN
        v_new_amount := ABS(v_new_amount);
    ELSE
        v_new_amount := -ABS(v_new_amount);
    END IF;

    -- 4. Get old linked transaction details
    IF v_old_linked_tx_id IS NOT NULL THEN
        SELECT account_id, amount
        INTO v_old_account_id, v_old_amount
        FROM public.account_transactions
        WHERE id = v_old_linked_tx_id;
    END IF;

    -- 5. Update the Transactions table
    UPDATE public.transactions
    SET
        name = v_new_description,
        amount = v_new_amount,
        transaction_date = v_new_date,
        category_id = v_new_category_id,
        notes = v_new_notes,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- 6. Logic branching based on account changes

    -- Case A: Same Account (or keeping same null)
    IF COALESCE(v_old_account_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(v_new_account_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
        IF v_new_account_id IS NOT NULL AND v_old_linked_tx_id IS NOT NULL THEN
            -- Determine new account amount
            SELECT (account_types.class = 'asset') INTO v_is_asset
            FROM public.accounts
            JOIN public.account_types ON accounts.account_type_id = account_types.id
            WHERE accounts.id = v_new_account_id;

            IF v_new_type = 'income' THEN
                v_account_amount := ABS((p_input->>'amount')::DECIMAL);
            ELSE
                IF v_is_asset THEN
                    v_account_amount := -ABS((p_input->>'amount')::DECIMAL);
                ELSE
                    v_account_amount := ABS((p_input->>'amount')::DECIMAL);
                END IF;
            END IF;

            -- Update account transaction
            UPDATE public.account_transactions
            SET
                amount = v_account_amount,
                description = v_new_description,
                transaction_date = v_new_date
            WHERE id = v_old_linked_tx_id;

            -- Adjust account balance
            UPDATE public.accounts
            SET current_balance = current_balance - v_old_amount + v_account_amount
            WHERE id = v_new_account_id;
        END IF;

    -- Case B: Account Changed (Move / Add / Remove)
    ELSE
        -- 1. Remove Old
        IF v_old_linked_tx_id IS NOT NULL THEN
            -- Revert balance
            UPDATE public.accounts
            SET current_balance = current_balance - v_old_amount
            WHERE id = v_old_account_id;

            -- Unlink and delete
            UPDATE public.transactions SET linked_account_transaction_id = NULL WHERE id = p_transaction_id;
            DELETE FROM public.account_transactions WHERE id = v_old_linked_tx_id;
        END IF;

        -- 2. Add New
        IF v_new_account_id IS NOT NULL THEN
            SELECT (account_types.class = 'asset') INTO v_is_asset
            FROM public.accounts
            JOIN public.account_types ON accounts.account_type_id = account_types.id
            WHERE accounts.id = v_new_account_id;

            IF v_new_type = 'income' THEN
                v_tx_type := CASE WHEN v_is_asset THEN 'deposit' ELSE 'payment' END;
                v_account_amount := ABS((p_input->>'amount')::DECIMAL);
            ELSE
                IF v_is_asset THEN
                    v_tx_type := COALESCE(v_new_tx_type, 'withdrawal');
                    v_account_amount := -ABS((p_input->>'amount')::DECIMAL);
                ELSE
                    v_tx_type := COALESCE(v_new_tx_type, 'adjustment');
                    v_account_amount := ABS((p_input->>'amount')::DECIMAL);
                END IF;
            END IF;

            INSERT INTO public.account_transactions (
                user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id
            ) VALUES (
                auth.uid(), v_new_account_id, v_account_amount, v_tx_type, v_new_description, v_new_date, p_transaction_id
            ) RETURNING id INTO v_new_linked_tx_id;

            -- Link to transaction
            UPDATE public.transactions SET linked_account_transaction_id = v_new_linked_tx_id WHERE id = p_transaction_id;

            -- Update balance
            UPDATE public.accounts
            SET current_balance = current_balance + v_account_amount
            WHERE id = v_new_account_id;
        END IF;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
