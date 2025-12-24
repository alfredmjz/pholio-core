-- Migration: 004_finance_transactions
-- Description: Unified Transaction System
-- Previous: 002 (transactions), 005 (account_transactions), 006 (linking)
-- Merges: All transaction-related tables and constraints

-- =============================================================================
-- TABLE: transactions (Allocation/Budget Tracking)
-- =============================================================================

DROP TABLE IF EXISTS public.transactions CASCADE;

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.allocation_categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    external_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CHECK (amount != 0)
);

CREATE INDEX transactions_user_id_idx ON public.transactions(user_id);
CREATE INDEX transactions_category_idx ON public.transactions(category_id);
CREATE INDEX transactions_date_idx ON public.transactions(transaction_date DESC);
CREATE INDEX transactions_user_date_idx ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX transactions_external_id_idx ON public.transactions(external_id) WHERE external_id IS NOT NULL;

-- Composite index from 006
CREATE INDEX IF NOT EXISTS idx_transactions_user_category
ON transactions(user_id, category_id)
WHERE category_id IS NOT NULL;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE: account_transactions (Bank/Account Ledger)
-- ============================================================================

DROP TABLE IF EXISTS public.account_transactions CASCADE;

CREATE TABLE public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    amount DECIMAL(15, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'deposit', 'withdrawal', 'interest', 'payment',
        'adjustment', 'contribution', 'transfer'
    )),
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Link to allocations system (Foreign key added below or inline)
    linked_allocation_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_txn_account ON public.account_transactions(account_id, transaction_date DESC);
CREATE INDEX idx_account_txn_user ON public.account_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_txn_linked
ON public.account_transactions(linked_allocation_transaction_id)
WHERE linked_allocation_transaction_id IS NOT NULL;

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own account transactions" ON public.account_transactions;
CREATE POLICY "Users manage own account transactions"
ON public.account_transactions FOR ALL
USING (auth.uid() = user_id);

-- ============================================================================
-- UNIFIED LINKING: Bidirectional Relationship
-- ============================================================================

-- Add optional reverse link to transactions (for bidirectional navigation)
-- This matches logic from 006
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS linked_account_transaction_id UUID
REFERENCES public.account_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_linked_account
ON public.transactions(linked_account_transaction_id)
WHERE linked_account_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.account_transactions.linked_allocation_transaction_id IS
'Links to allocation transaction for unified transaction tracking';

COMMENT ON COLUMN public.transactions.linked_account_transaction_id IS
'Optional reverse link to account transaction for bidirectional navigation';

-- =============================================================================
-- FUNCTION: get_allocation_summary (Depends on transactions)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_allocation_summary(
    p_allocation_id UUID
) RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF NOT EXISTS (
        SELECT 1 FROM public.allocations
        WHERE id = p_allocation_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Allocation not found or unauthorized';
    END IF;

    -- Get the allocation's year and month for filtering transactions
    WITH allocation_period AS (
        SELECT year, month, user_id
        FROM public.allocations
        WHERE id = p_allocation_id
    ),
    -- Single aggregation of transactions (used by both categories and summary)
    transaction_spend AS (
        SELECT
            category_id,
            SUM(ABS(amount)) as total_spend,
            COUNT(*) as transaction_count
        FROM public.transactions t
        CROSS JOIN allocation_period ap
        WHERE t.user_id = ap.user_id
          AND EXTRACT(YEAR FROM t.transaction_date) = ap.year
          AND EXTRACT(MONTH FROM t.transaction_date) = ap.month
        GROUP BY category_id
    )
    SELECT json_build_object(
        'allocation', (
            SELECT row_to_json(a)
            FROM public.allocations a
            WHERE a.id = p_allocation_id
        ),
        'categories', (
            SELECT json_agg(
                json_build_object(
                    'id', ac.id,
                    'name', ac.name,
                    'budget_cap', ac.budget_cap,
                    'is_recurring', ac.is_recurring,
                    'display_order', ac.display_order,
                    'color', ac.color,
                    'icon', ac.icon,
                    'notes', ac.notes,
                    'actual_spend', COALESCE(ts.total_spend, 0),
                    'remaining', ac.budget_cap - COALESCE(ts.total_spend, 0),
                    'utilization_percentage', CASE
                        WHEN ac.budget_cap > 0 THEN
                            ROUND((COALESCE(ts.total_spend, 0) / ac.budget_cap * 100)::numeric, 2)
                        ELSE 0
                    END,
                    'transaction_count', COALESCE(ts.transaction_count, 0),
                    'allocation_id', ac.allocation_id,
                    'user_id', ac.user_id,
                    'created_at', ac.created_at,
                    'updated_at', ac.updated_at
                )
                ORDER BY ac.display_order
            )
            FROM public.allocation_categories ac
            LEFT JOIN transaction_spend ts ON ts.category_id = ac.id
            WHERE ac.allocation_id = p_allocation_id
        ),
        'summary', (
            SELECT json_build_object(
                'total_budget_caps', COALESCE(SUM(ac.budget_cap), 0),
                'total_actual_spend', (
                    -- Sum ALL transaction spend for this month, including uncategorized
                    SELECT COALESCE(SUM(total_spend), 0)
                    FROM transaction_spend
                ),
                'unallocated_funds', a.expected_income - COALESCE(SUM(ac.budget_cap), 0),
                'overall_utilization', CASE
                    WHEN COALESCE(SUM(ac.budget_cap), 0) > 0 THEN
                        ROUND(((
                            SELECT COALESCE(SUM(total_spend), 0)
                            FROM transaction_spend
                        ) / SUM(ac.budget_cap) * 100)::numeric, 2)
                    ELSE 0
                END
            )
            FROM public.allocations a
            LEFT JOIN public.allocation_categories ac ON ac.allocation_id = a.id
            WHERE a.id = p_allocation_id
            GROUP BY a.id, a.expected_income
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- GRANTS & ANALYZE
-- =============================================================================

GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.account_transactions TO authenticated;
GRANT SELECT ON public.transactions TO anon;

ANALYZE public.transactions;
ANALYZE public.account_transactions;
