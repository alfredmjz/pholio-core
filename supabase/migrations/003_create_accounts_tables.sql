-- Migration: 003_create_accounts_tables
-- Description: Creates tables for accounts (assets/liabilities) tracking for net worth calculation
-- Created: 2025-12-05
-- Note: Flexible design to accommodate international users with customizable account types

-- =============================================================================
-- TYPE: account_class (Asset vs Liability classification - universal)
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE public.account_class AS ENUM (
        'asset',
        'liability'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- TABLE: account_types (User-customizable account types)
-- =============================================================================

DROP TABLE IF EXISTS public.account_types CASCADE;

CREATE TABLE public.account_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for system defaults

    -- Type details
    name VARCHAR(100) NOT NULL,
    class public.account_class NOT NULL,
    description TEXT,

    -- Categorization for grouping (e.g., 'banking', 'investment', 'retirement', 'debt', 'property')
    category VARCHAR(50) NOT NULL DEFAULT 'other',

    -- Is this a registered/tax-advantaged account (TFSA, RRSP, 401k, ISA, etc.)?
    is_tax_advantaged BOOLEAN DEFAULT false,

    -- Icon and display
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,

    -- System vs user-created
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,

    -- For system types, name must be unique globally; for user types, unique per user
    CONSTRAINT unique_system_type UNIQUE NULLS NOT DISTINCT (user_id, name)
);

CREATE INDEX account_types_user_idx ON public.account_types(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX account_types_system_idx ON public.account_types(is_system) WHERE is_system = true;
CREATE INDEX account_types_class_idx ON public.account_types(class);

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

-- System types are visible to all, user types only to owner
DROP POLICY IF EXISTS "Anyone can view system account types" ON public.account_types;
CREATE POLICY "Anyone can view system account types"
ON public.account_types FOR SELECT
USING (is_system = true OR user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own account types" ON public.account_types;
CREATE POLICY "Users can insert own account types"
ON public.account_types FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS "Users can update own account types" ON public.account_types;
CREATE POLICY "Users can update own account types"
ON public.account_types FOR UPDATE
USING (auth.uid() = user_id AND is_system = false);

DROP POLICY IF EXISTS "Users can delete own account types" ON public.account_types;
CREATE POLICY "Users can delete own account types"
ON public.account_types FOR DELETE
USING (auth.uid() = user_id AND is_system = false);

-- =============================================================================
-- INSERT DEFAULT SYSTEM ACCOUNT TYPES
-- =============================================================================

INSERT INTO public.account_types (user_id, name, class, category, is_tax_advantaged, icon, sort_order, is_system) VALUES
    -- Banking (Assets)
    (NULL, 'Checking Account', 'asset', 'banking', false, 'wallet', 1, true),
    (NULL, 'Savings Account', 'asset', 'banking', false, 'piggy-bank', 2, true),
    (NULL, 'Cash', 'asset', 'banking', false, 'banknote', 3, true),

    -- Investments (Assets)
    (NULL, 'Investment Account', 'asset', 'investment', false, 'trending-up', 10, true),
    (NULL, 'Brokerage Account', 'asset', 'investment', false, 'bar-chart-2', 11, true),
    (NULL, 'GIC / CD', 'asset', 'investment', false, 'lock', 12, true),

    -- Tax-Advantaged (Assets) - Generic names, users can customize
    (NULL, 'Tax-Free Savings', 'asset', 'retirement', true, 'shield', 20, true),
    (NULL, 'Retirement Account', 'asset', 'retirement', true, 'landmark', 21, true),
    (NULL, 'Education Savings', 'asset', 'retirement', true, 'graduation-cap', 22, true),
    (NULL, 'First Home Savings', 'asset', 'retirement', true, 'home', 23, true),

    -- Property & Assets
    (NULL, 'Real Estate', 'asset', 'property', false, 'building', 30, true),
    (NULL, 'Vehicle', 'asset', 'property', false, 'car', 31, true),
    (NULL, 'Other Asset', 'asset', 'property', false, 'box', 32, true),

    -- Credit (Liabilities)
    (NULL, 'Credit Card', 'liability', 'credit', false, 'credit-card', 40, true),
    (NULL, 'Line of Credit', 'liability', 'credit', false, 'minus-circle', 41, true),

    -- Loans (Liabilities)
    (NULL, 'Mortgage', 'liability', 'debt', false, 'home', 50, true),
    (NULL, 'Personal Loan', 'liability', 'debt', false, 'file-text', 51, true),
    (NULL, 'Student Loan', 'liability', 'debt', false, 'graduation-cap', 52, true),
    (NULL, 'Auto Loan', 'liability', 'debt', false, 'car', 53, true),
    (NULL, 'Other Debt', 'liability', 'debt', false, 'alert-circle', 54, true)

ON CONFLICT DO NOTHING;

-- =============================================================================
-- TABLE: accounts
-- =============================================================================

DROP TABLE IF EXISTS public.accounts CASCADE;

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Account details
    name VARCHAR(255) NOT NULL,
    account_type_id UUID NOT NULL REFERENCES public.account_types(id) ON DELETE RESTRICT,
    institution VARCHAR(255),
    account_number_last4 VARCHAR(4),

    -- Balance tracking
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'CAD' NOT NULL,

    -- Credit card / line of credit specific
    credit_limit DECIMAL(15, 2),

    -- Loan/Mortgage specific
    original_loan_amount DECIMAL(15, 2),
    loan_interest_rate DECIMAL(5, 4),
    loan_start_date DATE,
    loan_term_months INTEGER,

    -- Tax-advantaged account specific (contribution room)
    contribution_room DECIMAL(15, 2),

    -- Notes for user
    notes TEXT,

    -- Future: Plaid/Flinks integration
    external_account_id VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true NOT NULL,

    -- UI customization
    color VARCHAR(7),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX accounts_user_idx ON public.accounts(user_id, is_active);
CREATE INDEX accounts_type_idx ON public.accounts(account_type_id);
CREATE INDEX accounts_sort_order_idx ON public.accounts(user_id, sort_order);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
CREATE POLICY "Users can view own accounts"
ON public.accounts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts"
ON public.accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
CREATE POLICY "Users can update own accounts"
ON public.accounts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can delete own accounts"
ON public.accounts FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE: account_balances (Historical snapshots for net worth trends)
-- =============================================================================

DROP TABLE IF EXISTS public.account_balances CASCADE;

CREATE TABLE public.account_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Snapshot data
    balance DECIMAL(15, 2) NOT NULL,
    date DATE NOT NULL,

    -- Source of the snapshot
    source VARCHAR(50) DEFAULT 'manual' NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,

    CONSTRAINT unique_account_date UNIQUE(account_id, date)
);

CREATE INDEX account_balances_account_idx ON public.account_balances(account_id, date DESC);
CREATE INDEX account_balances_user_date_idx ON public.account_balances(user_id, date DESC);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account balances" ON public.account_balances;
CREATE POLICY "Users can view own account balances"
ON public.account_balances FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own account balances" ON public.account_balances;
CREATE POLICY "Users can insert own account balances"
ON public.account_balances FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own account balances" ON public.account_balances;
CREATE POLICY "Users can update own account balances"
ON public.account_balances FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own account balances" ON public.account_balances;
CREATE POLICY "Users can delete own account balances"
ON public.account_balances FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTION: get_net_worth_summary
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_net_worth_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT json_build_object(
        'total_assets', COALESCE(SUM(CASE
            WHEN at.class = 'asset' THEN a.current_balance
            ELSE 0
        END), 0),
        'total_liabilities', COALESCE(SUM(CASE
            WHEN at.class = 'liability' THEN ABS(a.current_balance)
            ELSE 0
        END), 0),
        'net_worth', COALESCE(SUM(CASE
            WHEN at.class = 'asset' THEN a.current_balance
            ELSE -ABS(a.current_balance)
        END), 0),
        'accounts_by_category', (
            SELECT json_agg(category_summary)
            FROM (
                SELECT json_build_object(
                    'category', at2.category,
                    'class', at2.class,
                    'count', COUNT(*),
                    'total_balance', SUM(a2.current_balance)
                ) as category_summary
                FROM public.accounts a2
                JOIN public.account_types at2 ON at2.id = a2.account_type_id
                WHERE a2.user_id = p_user_id AND a2.is_active = true
                GROUP BY at2.category, at2.class
                ORDER BY at2.class, SUM(a2.current_balance) DESC
            ) t
        ),
        'accounts', (
            SELECT json_agg(account_data ORDER BY a3.sort_order)
            FROM (
                SELECT json_build_object(
                    'id', a3.id,
                    'name', a3.name,
                    'type_name', at3.name,
                    'type_category', at3.category,
                    'class', at3.class,
                    'institution', a3.institution,
                    'current_balance', a3.current_balance,
                    'currency', a3.currency,
                    'color', COALESCE(a3.color, '#' || LPAD(TO_HEX((HASHTEXT(a3.id::text) & 16777215)), 6, '0')),
                    'icon', COALESCE(a3.icon, at3.icon),
                    'is_tax_advantaged', at3.is_tax_advantaged
                ) as account_data, a3.sort_order
                FROM public.accounts a3
                JOIN public.account_types at3 ON at3.id = a3.account_type_id
                WHERE a3.user_id = p_user_id AND a3.is_active = true
            ) x
        ),
        'tax_advantaged_accounts', (
            SELECT json_agg(registered_data)
            FROM (
                SELECT json_build_object(
                    'id', a4.id,
                    'name', a4.name,
                    'type_name', at4.name,
                    'current_balance', a4.current_balance,
                    'contribution_room', a4.contribution_room
                ) as registered_data
                FROM public.accounts a4
                JOIN public.account_types at4 ON at4.id = a4.account_type_id
                WHERE a4.user_id = p_user_id
                  AND a4.is_active = true
                  AND at4.is_tax_advantaged = true
            ) r
        )
    ) INTO result
    FROM public.accounts a
    JOIN public.account_types at ON at.id = a.account_type_id
    WHERE a.user_id = p_user_id AND a.is_active = true;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- FUNCTION: get_cashflow_summary
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_cashflow_summary(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT json_build_object(
        'total_income', COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
        'total_expenses', COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
        'net_cashflow', COALESCE(SUM(amount), 0),
        'transaction_count', COUNT(*),
        'daily_data', (
            SELECT json_agg(daily_summary ORDER BY date)
            FROM (
                SELECT json_build_object(
                    'date', transaction_date,
                    'income', COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
                    'expenses', COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
                    'net', COALESCE(SUM(amount), 0)
                ) as daily_summary, transaction_date as date
                FROM public.transactions
                WHERE user_id = p_user_id
                  AND transaction_date >= p_start_date
                  AND transaction_date <= p_end_date
                GROUP BY transaction_date
            ) d
        ),
        'monthly_data', (
            SELECT json_agg(monthly_summary ORDER BY month)
            FROM (
                SELECT json_build_object(
                    'month', DATE_TRUNC('month', transaction_date),
                    'income', COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
                    'expenses', COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
                    'net', COALESCE(SUM(amount), 0)
                ) as monthly_summary, DATE_TRUNC('month', transaction_date) as month
                FROM public.transactions
                WHERE user_id = p_user_id
                  AND transaction_date >= p_start_date
                  AND transaction_date <= p_end_date
                GROUP BY DATE_TRUNC('month', transaction_date)
            ) m
        )
    ) INTO result
    FROM public.transactions
    WHERE user_id = p_user_id
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- FUNCTION: get_net_worth_trend
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_net_worth_trend(
    p_user_id UUID,
    p_months INTEGER DEFAULT 12
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Authorization check
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT json_agg(trend_data ORDER BY month)
    INTO result
    FROM (
        SELECT json_build_object(
            'month', DATE_TRUNC('month', date),
            'total_assets', SUM(CASE
                WHEN at.class = 'asset' THEN ab.balance
                ELSE 0
            END),
            'total_liabilities', SUM(CASE
                WHEN at.class = 'liability' THEN ABS(ab.balance)
                ELSE 0
            END),
            'net_worth', SUM(CASE
                WHEN at.class = 'asset' THEN ab.balance
                ELSE -ABS(ab.balance)
            END)
        ) as trend_data, DATE_TRUNC('month', ab.date) as month
        FROM public.account_balances ab
        JOIN public.accounts a ON a.id = ab.account_id
        JOIN public.account_types at ON at.id = a.account_type_id
        WHERE ab.user_id = p_user_id
          AND ab.date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)
        GROUP BY DATE_TRUNC('month', ab.date)
    ) t;

    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT ALL ON public.account_types TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.account_balances TO authenticated;

GRANT SELECT ON public.account_types TO anon;
GRANT SELECT ON public.accounts TO anon;
GRANT SELECT ON public.account_balances TO anon;

-- =============================================================================
-- ANALYZE TABLES
-- =============================================================================

ANALYZE account_types;
ANALYZE accounts;
ANALYZE account_balances;
