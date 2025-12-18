-- Migration 003: Unified Accounts Schema for Balance Sheet
-- Combines best features from original 003 and 006 migrations
-- Created: 2024-12-18
--
-- Features:
-- - Customizable account types (system defaults + user-created)
-- - Optional contribution room tracking (user choice per account)
-- - Transaction history with allocation linking
-- - Automatic balance history via triggers
-- - Interest rate tracking for debt/savings
-- - Multi-currency support (default: CAD)

-- ============================================================================
-- CLEANUP: Remove any existing objects from previous migration attempts
-- ============================================================================

DROP TABLE IF EXISTS public.account_transactions CASCADE;
DROP TABLE IF EXISTS public.account_history CASCADE;
DROP TABLE IF EXISTS public.account_balances CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.account_types CASCADE;

-- ============================================================================
-- TABLE: account_types (Customizable account type definitions)
-- ============================================================================

CREATE TABLE public.account_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = system default

    name VARCHAR(100) NOT NULL,
    class TEXT NOT NULL CHECK (class IN ('asset', 'liability')),
    category VARCHAR(50) NOT NULL DEFAULT 'other',

    -- Tax-advantaged flag (for TFSA, RRSP, 401k, ISA, etc.)
    is_tax_advantaged BOOLEAN DEFAULT false,

    -- Display options
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,

    -- System vs user-created
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- For system types, name must be unique globally; for user types, unique per user
    CONSTRAINT unique_type_per_user UNIQUE NULLS NOT DISTINCT (user_id, name)
);

CREATE INDEX idx_account_types_user ON public.account_types(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_account_types_system ON public.account_types(is_system) WHERE is_system = true;
CREATE INDEX idx_account_types_class ON public.account_types(class);

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

-- System types visible to all, user types only to owner
DROP POLICY IF EXISTS "View account types" ON public.account_types;
CREATE POLICY "View account types"
ON public.account_types FOR SELECT
USING (is_system = true OR user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage own account types" ON public.account_types;
CREATE POLICY "Manage own account types"
ON public.account_types FOR ALL
USING (auth.uid() = user_id AND is_system = false)
WITH CHECK (auth.uid() = user_id AND is_system = false);

-- ============================================================================
-- INSERT DEFAULT SYSTEM ACCOUNT TYPES (Generic for international use)
-- ============================================================================

INSERT INTO public.account_types (user_id, name, class, category, is_tax_advantaged, icon, sort_order, is_system) VALUES
    -- Banking (Assets)
    (NULL, 'Checking Account', 'asset', 'banking', false, 'wallet', 1, true),
    (NULL, 'Savings Account', 'asset', 'banking', false, 'piggy-bank', 2, true),
    (NULL, 'Cash', 'asset', 'banking', false, 'banknote', 3, true),
    (NULL, 'Emergency Fund', 'asset', 'banking', false, 'shield', 4, true),

    -- Investments (Assets)
    (NULL, 'Investment Account', 'asset', 'investment', false, 'trending-up', 10, true),
    (NULL, 'Brokerage Account', 'asset', 'investment', false, 'bar-chart-2', 11, true),
    (NULL, 'GIC / CD', 'asset', 'investment', false, 'lock', 12, true),

    -- Retirement/Tax-Advantaged (Assets) - Generic names
    (NULL, 'Tax-Advantaged Savings', 'asset', 'retirement', true, 'shield-check', 20, true),
    (NULL, 'Retirement Account', 'asset', 'retirement', true, 'landmark', 21, true),
    (NULL, 'Education Savings', 'asset', 'retirement', true, 'graduation-cap', 22, true),

    -- Property & Other Assets
    (NULL, 'Real Estate', 'asset', 'property', false, 'building', 30, true),
    (NULL, 'Vehicle', 'asset', 'property', false, 'car', 31, true),
    (NULL, 'Other Asset', 'asset', 'other', false, 'box', 32, true),

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

-- ============================================================================
-- TABLE: accounts (User's actual accounts)
-- ============================================================================

DROP TABLE IF EXISTS public.accounts CASCADE;

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    account_type_id UUID NOT NULL REFERENCES public.account_types(id) ON DELETE RESTRICT,
    institution VARCHAR(255),
    account_number_last4 VARCHAR(4),

    -- Balance tracking
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'CAD' NOT NULL,

    -- Credit/Line of Credit specific
    credit_limit DECIMAL(15, 2),

    -- Loan/Debt specific
    original_amount DECIMAL(15, 2),
    interest_rate DECIMAL(5, 4),  -- 0.0650 = 6.50% APR/APY
    interest_type TEXT CHECK (interest_type IN ('simple', 'compound', 'none')),
    loan_start_date DATE,
    loan_term_months INTEGER,

    -- Savings goals
    target_balance DECIMAL(15, 2),

    -- Contribution room tracking (USER CHOICE - optional)
    track_contribution_room BOOLEAN DEFAULT false,
    contribution_room DECIMAL(15, 2),
    annual_contribution_limit DECIMAL(15, 2),

    -- Display & metadata
    notes TEXT,
    color VARCHAR(7),
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    -- For future Plaid/bank integrations
    external_account_id VARCHAR(255) UNIQUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: if tracking contribution room, contribution_room must not be null
    CONSTRAINT valid_contribution_tracking CHECK (
        track_contribution_room = false OR contribution_room IS NOT NULL
    )
);

CREATE INDEX idx_accounts_user ON public.accounts(user_id, is_active);
CREATE INDEX idx_accounts_type ON public.accounts(account_type_id);
CREATE INDEX idx_accounts_sort ON public.accounts(user_id, display_order);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
CREATE POLICY "Users manage own accounts"
ON public.accounts FOR ALL
USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE: account_history (Balance snapshots over time)
-- ============================================================================

DROP TABLE IF EXISTS public.account_history CASCADE;

CREATE TABLE public.account_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    balance DECIMAL(15, 2) NOT NULL,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    source VARCHAR(50) DEFAULT 'auto',  -- 'auto', 'manual', 'import'

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_account_date UNIQUE(account_id, recorded_at)
);

CREATE INDEX idx_account_history_account ON public.account_history(account_id, recorded_at DESC);
CREATE INDEX idx_account_history_user_date ON public.account_history(user_id, recorded_at DESC);

ALTER TABLE public.account_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own account history" ON public.account_history;
CREATE POLICY "Users manage own account history"
ON public.account_history FOR ALL
USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE: account_transactions (Detailed transaction log)
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

    -- Optional link to allocations system
    linked_allocation_transaction_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_txn_account ON public.account_transactions(account_id, transaction_date DESC);
CREATE INDEX idx_account_txn_user ON public.account_transactions(user_id, transaction_date DESC);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own account transactions" ON public.account_transactions;
CREATE POLICY "Users manage own account transactions"
ON public.account_transactions FOR ALL
USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp on accounts
CREATE OR REPLACE FUNCTION public.update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accounts_updated_at_trigger ON public.accounts;
CREATE TRIGGER accounts_updated_at_trigger
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_accounts_updated_at();

-- Auto-record balance history when account balance changes
CREATE OR REPLACE FUNCTION public.record_balance_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_balance IS DISTINCT FROM NEW.current_balance THEN
        INSERT INTO public.account_history (account_id, user_id, balance, recorded_at, source)
        VALUES (NEW.id, NEW.user_id, NEW.current_balance, CURRENT_DATE, 'auto')
        ON CONFLICT (account_id, recorded_at)
        DO UPDATE SET balance = NEW.current_balance;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_balance_change_trigger ON public.accounts;
CREATE TRIGGER account_balance_change_trigger
    AFTER UPDATE OF current_balance ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.record_balance_change();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.account_types TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.account_history TO authenticated;
GRANT ALL ON public.account_transactions TO authenticated;
GRANT SELECT ON public.account_types TO anon;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.account_types IS 'Customizable account type definitions (system defaults + user-created)';
COMMENT ON TABLE public.accounts IS 'User accounts - assets and liabilities for balance sheet tracking';
COMMENT ON TABLE public.account_history IS 'Historical balance snapshots for charting and trend analysis';
COMMENT ON TABLE public.account_transactions IS 'Detailed transaction log for each account';
COMMENT ON COLUMN public.accounts.track_contribution_room IS 'User choice: enable contribution room tracking for this account';
COMMENT ON COLUMN public.accounts.contribution_room IS 'Remaining contribution room (for tax-advantaged accounts)';
COMMENT ON COLUMN public.accounts.annual_contribution_limit IS 'Annual contribution limit (for reference)';
COMMENT ON COLUMN public.accounts.interest_rate IS 'APR/APY as decimal (0.0650 = 6.50%)';

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

ANALYZE public.account_types;
ANALYZE public.accounts;
ANALYZE public.account_history;
ANALYZE public.account_transactions;
