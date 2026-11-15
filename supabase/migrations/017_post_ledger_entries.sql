-- =============================================================================
-- Atomic ledger posting
--
-- post_ledger_entries() records a new transaction in one database transaction: an optional budget
-- row (transactions), any number of ledger legs (account_transactions), the links between them and
-- the balance change of every leg. A failure anywhere leaves nothing behind.
--
-- The caller sends legs already signed and capped (calculateSignedDelta / checkTransactionCaps in
-- TypeScript); this function holds no sign or cap rules.
--
-- p_budget_row: NULL, or {category_id, name, amount, transaction_date, notes, source}. Only these
--   columns are read. recurring_expense_id is never accepted: the AFTER INSERT triggers of 010, 011
--   and 016 would post the row to its account a second time.
-- p_legs: array of {account_id, amount, transaction_type, description, transaction_date,
--   is_cash_advance, interest_period, transfer_pair}. transfer_pair is the 0-based index of the
--   other leg of a transfer; both legs are linked to each other.
-- Returns {"budget_row_id": uuid | null, "leg_ids": [uuid, ...]} with leg ids in input order.
--
-- Runs as the caller, so RLS applies: a leg on an account the caller cannot see is rejected. Each
-- leg is inserted before its balance moves, because the fee triggers of 012 find the row that
-- caused a balance change by amount. Additive and safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.post_ledger_entries(p_budget_row JSONB, p_legs JSONB) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_budget_id UUID;
    v_leg JSONB;
    v_account_id UUID;
    v_amount DECIMAL(15, 2);
    v_owner UUID;
    v_leg_id UUID;
    v_leg_ids UUID[] := ARRAY[]::UUID[];
    v_pair INTEGER;
    v_count INTEGER;
    i INTEGER;
BEGIN
    IF p_legs IS NOT NULL AND jsonb_typeof(p_legs) <> 'array' THEN
        RAISE EXCEPTION 'p_legs must be an array' USING ERRCODE = '22023';
    END IF;
    v_count := COALESCE(jsonb_array_length(p_legs), 0);
    IF p_budget_row IS NULL AND v_count = 0 THEN
        RAISE EXCEPTION 'Nothing to post' USING ERRCODE = '22023';
    END IF;

    IF p_budget_row IS NOT NULL THEN
        IF v_uid IS NULL THEN
            RAISE EXCEPTION 'A budget row needs a signed-in user' USING ERRCODE = '42501';
        END IF;
        INSERT INTO public.transactions (user_id, category_id, name, amount, transaction_date, notes, source)
        VALUES (
            v_uid,
            NULLIF(p_budget_row->>'category_id', '')::UUID,
            p_budget_row->>'name',
            (p_budget_row->>'amount')::DECIMAL(15, 2),
            (p_budget_row->>'transaction_date')::DATE,
            p_budget_row->>'notes',
            COALESCE(NULLIF(p_budget_row->>'source', ''), 'manual')
        )
        RETURNING id INTO v_budget_id;
    END IF;

    FOR i IN 0 .. v_count - 1 LOOP
        v_leg := p_legs->i;
        v_account_id := (v_leg->>'account_id')::UUID;
        v_amount := (v_leg->>'amount')::DECIMAL(15, 2);
        IF v_amount IS NULL THEN
            RAISE EXCEPTION 'Leg % has no amount', i USING ERRCODE = '22023';
        END IF;

        SELECT user_id INTO v_owner FROM public.accounts WHERE id = v_account_id FOR UPDATE;
        IF v_owner IS NULL THEN
            RAISE EXCEPTION 'Account % not found', v_account_id USING ERRCODE = 'P0002';
        END IF;

        INSERT INTO public.account_transactions (
            user_id, account_id, amount, transaction_type, description, transaction_date,
            linked_allocation_transaction_id, is_cash_advance, interest_period
        )
        VALUES (
            v_owner,
            v_account_id,
            v_amount,
            v_leg->>'transaction_type',
            v_leg->>'description',
            (v_leg->>'transaction_date')::DATE,
            v_budget_id,
            COALESCE((v_leg->>'is_cash_advance')::BOOLEAN, false),
            (v_leg->>'interest_period')::DATE
        )
        RETURNING id INTO v_leg_id;

        UPDATE public.accounts SET current_balance = current_balance + v_amount WHERE id = v_account_id;
        v_leg_ids := v_leg_ids || v_leg_id;
    END LOOP;

    FOR i IN 0 .. v_count - 1 LOOP
        v_pair := (p_legs->i->>'transfer_pair')::INTEGER;
        CONTINUE WHEN v_pair IS NULL;
        IF v_pair < 0 OR v_pair >= v_count OR v_pair = i THEN
            RAISE EXCEPTION 'Leg % has an invalid transfer_pair', i USING ERRCODE = '22023';
        END IF;
        UPDATE public.account_transactions
        SET linked_transfer_transaction_id = v_leg_ids[v_pair + 1]
        WHERE id = v_leg_ids[i + 1];
    END LOOP;

    IF v_budget_id IS NOT NULL AND v_count > 0 THEN
        UPDATE public.transactions SET linked_account_transaction_id = v_leg_ids[1] WHERE id = v_budget_id;
    END IF;

    RETURN jsonb_build_object('budget_row_id', v_budget_id, 'leg_ids', to_jsonb(v_leg_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.post_ledger_entries(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_ledger_entries(JSONB, JSONB) TO authenticated, service_role;
