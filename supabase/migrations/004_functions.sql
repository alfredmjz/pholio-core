-- Migration: 004_functions
-- Description: Complex RPC functions and stored procedures

-- =============================================================================
-- FUNCTION: get_allocation_summary
-- =============================================================================

-- Effective category budget = budget_cap + recurring_budget_cap.
CREATE OR REPLACE FUNCTION public.get_allocation_summary(
    p_allocation_id UUID
) RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.allocations WHERE id = p_allocation_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Allocation not found or unauthorized';
    END IF;

    WITH allocation_period AS (
        SELECT user_id, make_date(year, month, 1) AS period_start, (make_date(year, month, 1) + INTERVAL '1 month')::date AS next_period_start
        FROM public.allocations WHERE id = p_allocation_id
    ),
    transaction_spend AS (
        SELECT
            category_id,
            SUM(CASE WHEN category_id IS NOT NULL THEN -amount ELSE CASE WHEN amount < 0 THEN -amount ELSE 0 END END) as total_spend,
            COUNT(*) as transaction_count
        FROM public.transactions t
        CROSS JOIN allocation_period ap
        WHERE t.user_id = ap.user_id
          AND t.transaction_date >= ap.period_start
          AND t.transaction_date < ap.next_period_start
        GROUP BY category_id
    ),
    categorized_data AS (
        SELECT
            ac.id, ac.name, ac.budget_cap, ac.recurring_budget_cap, ac.is_recurring, ac.display_order, ac.color, ac.icon, ac.notes,
            COALESCE(ts.total_spend, 0) as actual_spend,
            (ac.budget_cap + ac.recurring_budget_cap) - COALESCE(ts.total_spend, 0) as remaining,
            CASE WHEN (ac.budget_cap + ac.recurring_budget_cap) > 0 THEN ROUND((COALESCE(ts.total_spend, 0) / (ac.budget_cap + ac.recurring_budget_cap) * 100)::numeric, 2) ELSE 0 END as utilization_percentage,
            COALESCE(ts.transaction_count, 0) as transaction_count,
            ac.allocation_id, ac.user_id, ac.created_at, ac.updated_at
        FROM public.allocation_categories ac
        LEFT JOIN transaction_spend ts ON ts.category_id = ac.id
        WHERE ac.allocation_id = p_allocation_id
    ),
    uncategorized_spend AS (
        SELECT
            '00000000-0000-0000-0000-000000000000'::uuid as id, 'Uncategorized' as name, 0 as budget_cap, 0 as recurring_budget_cap, false as is_recurring, 999 as display_order,
            'gray' as color, 'help-circle' as icon, 'Transactions without a category' as notes,
            COALESCE(ts.total_spend, 0) as actual_spend, -COALESCE(ts.total_spend, 0) as remaining, 0 as utilization_percentage,
            COALESCE(ts.transaction_count, 0) as transaction_count, p_allocation_id as allocation_id,
            (SELECT user_id FROM allocation_period) as user_id, NOW() as created_at, NOW() as updated_at
        FROM transaction_spend ts WHERE ts.category_id IS NULL
    ),
    all_categories_result AS (
        SELECT * FROM categorized_data UNION ALL SELECT * FROM uncategorized_spend
    )
    SELECT json_build_object(
        'allocation', (SELECT row_to_json(a) FROM public.allocations a WHERE a.id = p_allocation_id),
        'categories', (SELECT json_agg(c ORDER BY c.display_order) FROM all_categories_result c),
        'summary', (
            SELECT json_build_object(
                'total_budget_caps', COALESCE(SUM(ac.budget_cap + ac.recurring_budget_cap), 0),
                'total_actual_spend', (SELECT COALESCE(SUM(total_spend), 0) FROM transaction_spend),
                'unallocated_funds', a.expected_income - COALESCE(SUM(ac.budget_cap + ac.recurring_budget_cap), 0),
                'overall_utilization', CASE WHEN COALESCE(SUM(ac.budget_cap + ac.recurring_budget_cap), 0) > 0 THEN ROUND(((SELECT COALESCE(SUM(total_spend), 0) FROM transaction_spend) / SUM(ac.budget_cap + ac.recurring_budget_cap) * 100)::numeric, 2) ELSE 0 END
            )
            FROM public.allocations a
            LEFT JOIN public.allocation_categories ac ON ac.allocation_id = a.id
            WHERE a.id = p_allocation_id GROUP BY a.id, a.expected_income
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- FUNCTION: delete_unified_transaction
-- =============================================================================

-- A transfer's budget row links only its from-leg; the to-leg links back through
-- linked_allocation_transaction_id, so every leg is reversed and deleted.
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- FUNCTION: update_unified_transaction
-- =============================================================================

-- Mirrors calculateSignedDelta / calculateTransactionDetails (src/lib/account-validation-utils.ts,
-- src/lib/actions/unified-transaction-actions.ts):
--   type: transactionType from the input; when absent, the stored type if the intent and account are
--         unchanged or it fits the new intent; otherwise deposit/payment (income), withdrawal/adjustment (expense).
--   sign: transfer -> asset -ABS, liability +ABS;
--         asset     -> deposit/contribution/refund/interest +ABS, everything else -ABS;
--         liability -> payment/refund -ABS, everything else +ABS.
-- A transfer is one budget row (source 'transfer', +ABS, no category) and two linked ledger legs; both
-- legs follow the edit, and a transfer without two different accounts is rejected (returns FALSE).
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
            UPDATE public.account_transactions SET amount = v_to_amount, transaction_type = 'transfer', description = v_new_description, transaction_date = v_new_date WHERE id = v_old_to_tx_id;
            UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount + v_to_amount WHERE id = v_new_to_account_id;
            v_to_tx_id := v_old_to_tx_id;
        ELSE
            IF v_old_to_tx_id IS NOT NULL THEN
                UPDATE public.accounts SET current_balance = current_balance - v_old_to_amount WHERE id = v_old_to_account_id;
                DELETE FROM public.account_transactions WHERE id = v_old_to_tx_id;
            END IF;
            INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
            VALUES (auth.uid(), v_new_to_account_id, v_to_amount, 'transfer', v_new_description, v_new_date, p_transaction_id) RETURNING id INTO v_to_tx_id;
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

-- =============================================================================
-- FUNCTION: apply_template_to_allocation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_template_to_allocation(p_template_id UUID, p_allocation_id UUID) RETURNS INTEGER AS $$
DECLARE inserted_count INTEGER; template_user_id UUID; allocation_user_id UUID;
BEGIN
    SELECT user_id INTO template_user_id FROM public.allocation_templates WHERE id = p_template_id;
    SELECT user_id INTO allocation_user_id FROM public.allocations WHERE id = p_allocation_id;
    IF template_user_id IS NULL OR allocation_user_id IS NULL OR template_user_id != allocation_user_id OR template_user_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorized or not found'; END IF;

    UPDATE public.allocation_categories ac SET budget_cap = tc.budget_cap, is_recurring = tc.is_recurring, display_order = tc.display_order, color = tc.color, icon = tc.icon, notes = tc.notes, name = tc.name
    FROM public.template_categories tc WHERE ac.allocation_id = p_allocation_id AND tc.template_id = p_template_id AND LOWER(ac.name) = LOWER(tc.name);

    INSERT INTO public.allocation_categories (allocation_id, user_id, name, budget_cap, is_recurring, display_order, color, icon, notes)
    SELECT p_allocation_id, template_user_id, tc.name, tc.budget_cap, tc.is_recurring, tc.display_order, tc.color, tc.icon, tc.notes
    FROM public.template_categories tc WHERE tc.template_id = p_template_id AND NOT EXISTS (SELECT 1 FROM public.allocation_categories ac WHERE ac.allocation_id = p_allocation_id AND LOWER(ac.name) = LOWER(tc.name));

    DELETE FROM public.allocation_categories ac WHERE ac.allocation_id = p_allocation_id AND NOT EXISTS (SELECT 1 FROM public.template_categories tc WHERE tc.template_id = p_template_id AND LOWER(tc.name) = LOWER(ac.name)) AND LOWER(ac.name) NOT IN ('bills', 'subscriptions');

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
