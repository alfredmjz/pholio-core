-- Migration: 003_budgeting
-- Description: Budgeting structure and the Unified Transaction System

-- =============================================================================
-- TABLE: allocations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    expected_income DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT unique_user_year_month UNIQUE(user_id, year, month)
);

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own allocations" ON public.allocations;
CREATE POLICY "Users can manage own allocations" ON public.allocations FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_allocations_updated_at ON public.allocations;
CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE: allocation_categories
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.allocation_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    budget_cap DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_recurring BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20),
    icon VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.allocation_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own categories" ON public.allocation_categories;
CREATE POLICY "Users can manage own categories" ON public.allocation_categories FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_allocation_categories_updated_at ON public.allocation_categories;
CREATE TRIGGER update_allocation_categories_updated_at BEFORE UPDATE ON public.allocation_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- TABLE: allocation_templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.allocation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.allocation_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own templates" ON public.allocation_templates;
CREATE POLICY "Users can manage own templates" ON public.allocation_templates FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- TABLE: template_categories
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.allocation_templates(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    budget_cap DECIMAL(15, 2) NOT NULL DEFAULT 0,
    is_recurring BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20),
    icon VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.template_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own template categories" ON public.template_categories;
CREATE POLICY "Users can manage own template categories" ON public.template_categories FOR ALL USING (auth.uid() = (SELECT user_id FROM public.allocation_templates WHERE id = template_id));

-- =============================================================================
-- UNIFIED TRANSACTION SYSTEM
-- =============================================================================

-- 1. Allocation Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.allocation_categories(id) ON DELETE SET NULL,
    recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    external_id VARCHAR(255),
    notes TEXT,
    linked_account_transaction_id UUID, -- Forward reference added later via ALTER if needed, but here we can just define it
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CHECK (amount != 0)
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Account Transactions (Ledger)
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'interest', 'payment', 'adjustment', 'contribution', 'transfer')),
    description TEXT NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    linked_allocation_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own account transactions" ON public.account_transactions;
CREATE POLICY "Users manage own account transactions" ON public.account_transactions FOR ALL USING (auth.uid() = user_id);

-- Add the missing link back to transactions
-- Drop both the named constraint and any auto-generated duplicate before re-adding.
-- Safe on fresh installs (IF EXISTS is a no-op) and fixes existing DBs with the duplicate.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_linked_account_tx;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_linked_account_transaction_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT fk_linked_account_tx FOREIGN KEY (linked_account_transaction_id) REFERENCES public.account_transactions(id) ON DELETE SET NULL;


-- Indexes
CREATE INDEX IF NOT EXISTS transactions_date_idx ON public.transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_account_txn_account ON public.account_transactions(account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_expense_id ON public.transactions(recurring_expense_id);

-- Grants
GRANT ALL ON public.allocations TO authenticated;
GRANT ALL ON public.allocation_categories TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.account_transactions TO authenticated;

-- =============================================================================
-- TABLE: transaction_presets
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'interest', 'payment', 'adjustment', 'contribution', 'transfer', 'refund')),
    category_id UUID REFERENCES public.allocation_categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transaction_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own presets" ON public.transaction_presets;
CREATE POLICY "Users can manage own presets" ON public.transaction_presets FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_transaction_presets_updated_at ON public.transaction_presets;
CREATE TRIGGER update_transaction_presets_updated_at BEFORE UPDATE ON public.transaction_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transaction_presets_user ON public.transaction_presets(user_id);

-- Grants
GRANT ALL ON public.transaction_presets TO authenticated;

