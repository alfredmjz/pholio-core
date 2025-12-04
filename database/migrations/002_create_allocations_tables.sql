-- Migration: 002_create_allocations_tables
-- Description: Creates tables for monthly budget allocation feature
-- Created: 2025-12-02

-- =============================================================================
-- TABLE: allocations
-- =============================================================================

DROP TABLE IF EXISTS public.allocations CASCADE;

CREATE TABLE public.allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    expected_income DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (expected_income >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE(user_id, year, month)
);

CREATE INDEX allocations_user_year_month_idx ON public.allocations(user_id, year DESC, month DESC);
CREATE INDEX allocations_user_id_idx ON public.allocations(user_id);

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own allocations" ON public.allocations;
CREATE POLICY "Users can view own allocations"
ON public.allocations FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own allocations" ON public.allocations;
CREATE POLICY "Users can insert own allocations"
ON public.allocations FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own allocations" ON public.allocations;
CREATE POLICY "Users can update own allocations"
ON public.allocations FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own allocations" ON public.allocations;
CREATE POLICY "Users can delete own allocations"
ON public.allocations FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_allocations_updated_at ON public.allocations;
CREATE TRIGGER update_allocations_updated_at
    BEFORE UPDATE ON public.allocations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE: allocation_categories
-- =============================================================================

DROP TABLE IF EXISTS public.allocation_categories CASCADE;

CREATE TABLE public.allocation_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    budget_cap DECIMAL(15, 2) NOT NULL CHECK (budget_cap >= 0),
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(7),
    icon VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE(allocation_id, name)
);

CREATE INDEX allocation_categories_allocation_idx ON public.allocation_categories(allocation_id);
CREATE INDEX allocation_categories_user_idx ON public.allocation_categories(user_id);
CREATE INDEX allocation_categories_display_order_idx ON public.allocation_categories(allocation_id, display_order);

ALTER TABLE public.allocation_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own categories" ON public.allocation_categories;
CREATE POLICY "Users can view own categories"
ON public.allocation_categories FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON public.allocation_categories;
CREATE POLICY "Users can insert own categories"
ON public.allocation_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.allocation_categories;
CREATE POLICY "Users can update own categories"
ON public.allocation_categories FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON public.allocation_categories;
CREATE POLICY "Users can delete own categories"
ON public.allocation_categories FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_allocation_categories_updated_at ON public.allocation_categories;
CREATE TRIGGER update_allocation_categories_updated_at
    BEFORE UPDATE ON public.allocation_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE: transactions
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

-- =============================================================================
-- TABLE: allocation_templates
-- =============================================================================

DROP TABLE IF EXISTS public.allocation_templates CASCADE;

CREATE TABLE public.allocation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE(user_id, name)
);

CREATE INDEX allocation_templates_user_idx ON public.allocation_templates(user_id);
CREATE INDEX allocation_templates_default_idx ON public.allocation_templates(user_id, is_default) WHERE is_default = true;

ALTER TABLE public.allocation_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates" ON public.allocation_templates;
CREATE POLICY "Users can view own templates"
ON public.allocation_templates FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own templates" ON public.allocation_templates;
CREATE POLICY "Users can insert own templates"
ON public.allocation_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON public.allocation_templates;
CREATE POLICY "Users can update own templates"
ON public.allocation_templates FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON public.allocation_templates;
CREATE POLICY "Users can delete own templates"
ON public.allocation_templates FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_allocation_templates_updated_at ON public.allocation_templates;
CREATE TRIGGER update_allocation_templates_updated_at
    BEFORE UPDATE ON public.allocation_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE: template_categories
-- =============================================================================

DROP TABLE IF EXISTS public.template_categories CASCADE;

CREATE TABLE public.template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.allocation_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    budget_cap DECIMAL(15, 2) NOT NULL CHECK (budget_cap >= 0),
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(7),
    icon VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE(template_id, name)
);

CREATE INDEX template_categories_template_idx ON public.template_categories(template_id);
CREATE INDEX template_categories_display_order_idx ON public.template_categories(template_id, display_order);

ALTER TABLE public.template_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own template categories" ON public.template_categories;
CREATE POLICY "Users can view own template categories"
ON public.template_categories FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own template categories" ON public.template_categories;
CREATE POLICY "Users can insert own template categories"
ON public.template_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own template categories" ON public.template_categories;
CREATE POLICY "Users can update own template categories"
ON public.template_categories FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own template categories" ON public.template_categories;
CREATE POLICY "Users can delete own template categories"
ON public.template_categories FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTION: apply_template_to_allocation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_template_to_allocation(
    p_template_id UUID,
    p_allocation_id UUID
) RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
    template_user_id UUID;
    allocation_user_id UUID;
BEGIN
    SELECT user_id INTO template_user_id FROM public.allocation_templates WHERE id = p_template_id;
    SELECT user_id INTO allocation_user_id FROM public.allocations WHERE id = p_allocation_id;

    IF template_user_id IS NULL THEN
        RAISE EXCEPTION 'Template not found';
    END IF;

    IF allocation_user_id IS NULL THEN
        RAISE EXCEPTION 'Allocation not found';
    END IF;

    IF template_user_id != allocation_user_id THEN
        RAISE EXCEPTION 'Template and allocation must belong to same user';
    END IF;

    IF template_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    DELETE FROM public.allocation_categories WHERE allocation_id = p_allocation_id;

    INSERT INTO public.allocation_categories (
        allocation_id,
        user_id,
        name,
        budget_cap,
        is_recurring,
        display_order,
        color,
        icon,
        notes
    )
    SELECT
        p_allocation_id,
        template_user_id,
        name,
        budget_cap,
        is_recurring,
        display_order,
        color,
        icon,
        notes
    FROM public.template_categories
    WHERE template_id = p_template_id
    ORDER BY display_order;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- FUNCTION: get_allocation_summary
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

    -- Single aggregation of transactions (used by both categories and summary)
    -- This CTE eliminates duplicate transaction table scans for optimal performance
    WITH transaction_spend AS (
        SELECT
            category_id,
            SUM(ABS(amount)) as total_spend,
            COUNT(*) as transaction_count
        FROM public.transactions
        WHERE user_id = auth.uid()
          AND category_id IS NOT NULL
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
                'total_actual_spend', COALESCE(SUM(ts.total_spend), 0),
                'unallocated_funds', a.expected_income - COALESCE(SUM(ac.budget_cap), 0),
                'overall_utilization', CASE
                    WHEN COALESCE(SUM(ac.budget_cap), 0) > 0 THEN
                        ROUND((COALESCE(SUM(ts.total_spend), 0) / SUM(ac.budget_cap) * 100)::numeric, 2)
                    ELSE 0
                END
            )
            FROM public.allocations a
            LEFT JOIN public.allocation_categories ac ON ac.allocation_id = a.id
            LEFT JOIN transaction_spend ts ON ts.category_id = ac.id
            WHERE a.id = p_allocation_id
            GROUP BY a.id, a.expected_income
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- COMPOSITE INDEX FOR TRANSACTION QUERIES
-- =============================================================================
-- Optimizes the common query pattern: WHERE user_id = X AND category_id IS NOT NULL
-- This partial index only includes rows where category_id IS NOT NULL (saves space)

CREATE INDEX IF NOT EXISTS idx_transactions_user_category
ON transactions(user_id, category_id)
WHERE category_id IS NOT NULL;

-- =============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- =============================================================================
-- Update statistics so PostgreSQL can make better query planning decisions

ANALYZE transactions;
ANALYZE allocation_categories;
ANALYZE allocations;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.allocations TO authenticated;
GRANT ALL ON public.allocation_categories TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.allocation_templates TO authenticated;
GRANT ALL ON public.template_categories TO authenticated;

GRANT SELECT ON public.allocations TO anon;
GRANT SELECT ON public.allocation_categories TO anon;
GRANT SELECT ON public.transactions TO anon;
GRANT SELECT ON public.allocation_templates TO anon;
GRANT SELECT ON public.template_categories TO anon;

-- =============================================================================
-- REALTIME REPLICATION
-- =============================================================================
-- Enable Realtime for real-time data synchronization across clients

-- Note: These commands should be run manually via Supabase Dashboard
-- or executed after the tables are created:
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE allocation_categories;
-- ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
--
-- Or via Supabase Dashboard:
-- Database → Replication → Toggle "Realtime" for allocation_categories and transactions
