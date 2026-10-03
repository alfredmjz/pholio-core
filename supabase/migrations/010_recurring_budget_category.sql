-- Migration: 010_recurring_budget_category
-- Description:
--   Let each recurring expense choose which budget category it is bundled into.
--   * recurring_expenses.budget_category stores the chosen allocation category
--     NAME (nullable). NULL keeps the legacy fallback: subscriptions -> the
--     "Subscriptions" category, bills -> "Bills". A name is used instead of an
--     id because allocation categories are recreated for every month.
--   * allocation_categories.recurring_budget_cap stores the recurring system's
--     contribution to a category's budget. The user-editable `budget_cap` stays
--     the manual budget; the effective budget is `budget_cap + recurring_budget_cap`.
--
--   Safe to re-run: additive columns + CREATE OR REPLACE FUNCTION.

-- =============================================================================
-- COLUMNS
-- =============================================================================

ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS budget_category TEXT;
ALTER TABLE public.allocation_categories ADD COLUMN IF NOT EXISTS recurring_budget_cap DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- =============================================================================
-- FUNCTION: get_allocation_summary (effective budget = budget_cap + recurring_budget_cap)
-- =============================================================================

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
        SELECT year, month, user_id FROM public.allocations WHERE id = p_allocation_id
    ),
    transaction_spend AS (
        SELECT
            category_id,
            SUM(CASE WHEN category_id IS NOT NULL THEN -amount ELSE CASE WHEN amount < 0 THEN -amount ELSE 0 END END) as total_spend,
            COUNT(*) as transaction_count
        FROM public.transactions t
        CROSS JOIN allocation_period ap
        WHERE t.user_id = ap.user_id
          AND EXTRACT(YEAR FROM t.transaction_date) = ap.year
          AND EXTRACT(MONTH FROM t.transaction_date) = ap.month
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
