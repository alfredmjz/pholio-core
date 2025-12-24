-- Migration: 003_budgeting_allocations
-- Description: Monthly budget allocations, categories, and templates
-- Previous: 002_create_allocations_table.sql
-- Merges: 002_create_allocations_table.sql + parts of 006_unified_transaction_system.sql

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

    -- Enhanced fields from Unified System (originally 006)
    category_type VARCHAR(20) DEFAULT 'regular' CHECK (category_type IN ('regular', 'savings_goal', 'debt_payment')),
    linked_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE(allocation_id, name)
);

CREATE INDEX allocation_categories_allocation_idx ON public.allocation_categories(allocation_id);
CREATE INDEX allocation_categories_user_idx ON public.allocation_categories(user_id);
CREATE INDEX allocation_categories_display_order_idx ON public.allocation_categories(allocation_id, display_order);

-- Unified System Indexes
CREATE INDEX IF NOT EXISTS idx_allocation_cat_linked_account
ON public.allocation_categories(linked_account_id)
WHERE linked_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_allocation_cat_type
ON public.allocation_categories(category_type)
WHERE category_type != 'regular';

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

COMMENT ON COLUMN public.allocation_categories.category_type IS
'Type of category: regular (standard budget), savings_goal (linked to asset account), debt_payment (linked to liability account)';

COMMENT ON COLUMN public.allocation_categories.linked_account_id IS
'For savings_goal and debt_payment categories, the account to auto-select in transaction dialog';

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
        -- Note: templates don't currently store category_type or linked_account_id
        -- so these default to 'regular' and NULL
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
-- GRANT PERMISSIONS
-- =============================================================================

GRANT ALL ON public.allocations TO authenticated;
GRANT ALL ON public.allocation_categories TO authenticated;
GRANT ALL ON public.allocation_templates TO authenticated;
GRANT ALL ON public.template_categories TO authenticated;

GRANT SELECT ON public.allocations TO anon;
GRANT SELECT ON public.allocation_categories TO anon;
GRANT SELECT ON public.allocation_templates TO anon;
GRANT SELECT ON public.template_categories TO anon;

-- =============================================================================
-- ANALYZE TABLES
-- =============================================================================

ANALYZE public.allocations;
ANALYZE public.allocation_categories;
