-- Migration: 007_optimized_transaction_actions
-- Description: RPC for atomic transaction deletion

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
        -- Log error details if possible or just return false
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
