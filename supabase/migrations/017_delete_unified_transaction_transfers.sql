-- Delete both legs of a transfer.
--
-- A transfer's budget row (source = 'transfer') links to its from-leg through
-- transactions.linked_account_transaction_id; the to-leg is only linked back through
-- account_transactions.linked_allocation_transaction_id (and linked_transfer_transaction_id).
-- The 004 version of delete_unified_transaction reversed and deleted only the from-leg, so the
-- to-leg survived (its link was set to NULL by the FK) and the destination balance stayed changed.
--
-- Now every ledger row of a transfer is reversed and deleted. Other rows still only touch the
-- linked leg, as before.
--
-- CREATE OR REPLACE keeps the signature, owner and existing EXECUTE privileges, so re-running is safe.

CREATE OR REPLACE FUNCTION public.delete_unified_transaction(p_transaction_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_linked_tx_id UUID;
    v_source TEXT;
    v_leg RECORD;
BEGIN
    SELECT linked_account_transaction_id, source INTO v_linked_tx_id, v_source FROM public.transactions WHERE id = p_transaction_id AND user_id = auth.uid();
    IF NOT FOUND THEN RETURN FALSE; END IF;

    UPDATE public.transactions SET linked_account_transaction_id = NULL WHERE id = p_transaction_id;

    FOR v_leg IN
        SELECT id, account_id, amount FROM public.account_transactions
        WHERE id = v_linked_tx_id
           OR (v_source = 'transfer' AND linked_allocation_transaction_id = p_transaction_id AND user_id = auth.uid())
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
