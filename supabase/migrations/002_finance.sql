-- Migration: 002_finance
-- Description: Financial entities (Account types, Accounts, History, Recurring, Deleted accounts)

-- ============================================================================
-- TABLE: account_types
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    class TEXT NOT NULL CHECK (class IN ('asset', 'liability')),
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    is_tax_advantaged BOOLEAN DEFAULT false,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Stable machine key; behaviour branches on code, never on name
    code TEXT,
    CONSTRAINT unique_type_per_user UNIQUE NULLS NOT DISTINCT (user_id, name)
);

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View account types" ON public.account_types;
CREATE POLICY "View account types" ON public.account_types FOR SELECT USING (is_system = true OR user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Manage own account types" ON public.account_types;
CREATE POLICY "Manage own account types" ON public.account_types FOR ALL USING (auth.uid() = user_id AND is_system = false);

-- The core types. Retired legacy and user-created types stay in older databases with
-- is_active = false so their accounts keep a valid foreign key.
INSERT INTO public.account_types (user_id, name, class, category, is_tax_advantaged, icon, sort_order, is_system, code) VALUES
    (NULL, 'Chequing',          'asset',     'banking',    false, 'wallet',       1, true, 'chequing'),
    (NULL, 'Savings',           'asset',     'banking',    false, 'piggy-bank',   2, true, 'savings'),
    (NULL, 'Investment',        'asset',     'investment', false, 'trending-up',  3, true, 'investment'),
    (NULL, 'Credit Card',       'liability', 'credit',     false, 'credit-card',  4, true, 'credit_card'),
    (NULL, 'Line of Credit',    'liability', 'credit',     false, 'minus-circle', 5, true, 'line_of_credit'),
    (NULL, 'Mortgage',          'liability', 'debt',       false, 'home',         6, true, 'mortgage'),
    (NULL, 'Loans',             'liability', 'debt',       false, 'file-text',    7, true, 'loan'),
    (NULL, 'Other (Asset)',     'asset',     'other',      false, 'circle-help',  8, true, 'other'),
    (NULL, 'Other (Liability)', 'liability', 'other',      false, 'circle-help',  9, true, 'other')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABLE: accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type_id UUID NOT NULL REFERENCES public.account_types(id) ON DELETE RESTRICT,
    institution VARCHAR(255),
    account_number_last4 VARCHAR(4),
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'CAD' NOT NULL,
    credit_limit DECIMAL(15, 2),
    original_amount DECIMAL(15, 2),
    interest_rate DECIMAL(5, 4),
    interest_type TEXT CHECK (interest_type IN ('simple', 'compound', 'none')),
    loan_start_date DATE,
    loan_term_months INTEGER,
    payment_due_date SMALLINT CHECK (payment_due_date >= 1 AND payment_due_date <= 31),
    target_balance DECIMAL(15, 2),
    notes TEXT,
    color VARCHAR(7),
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Per-account field configuration for the "Other" type
    field_visibility JSONB,
    track_contribution_room BOOLEAN DEFAULT false,
    contribution_room DECIMAL(15, 2),
    annual_contribution_limit DECIMAL(15, 2),
    contribution_plan TEXT,
    contribution_room_as_of DATE,
    CONSTRAINT valid_contribution_plan CHECK (
        contribution_plan IS NULL OR contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp', 'other')
    ),
    -- Registered-plan accounts take their room from contribution_rooms
    CONSTRAINT valid_contribution_tracking CHECK (
        track_contribution_room = false
        OR contribution_room IS NOT NULL
        OR contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
    )
);

COMMENT ON COLUMN public.accounts.track_contribution_room IS 'User choice: enable contribution room tracking for this account';
COMMENT ON COLUMN public.accounts.contribution_plan IS 'Registered plan code used for contribution rules: tfsa, rrsp, fhsa, resp or other';
COMMENT ON COLUMN public.accounts.contribution_room_as_of IS 'Date contribution_room applies to (only for "other" and plan-less accounts)';
COMMENT ON COLUMN public.accounts.contribution_room IS 'Available contribution room on contribution_room_as_of (only for "other" and plan-less accounts)';
COMMENT ON COLUMN public.accounts.annual_contribution_limit IS 'Annual limit override for the year of contribution_room_as_of (only for "other" and plan-less accounts)';

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
CREATE POLICY "Users manage own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS accounts_updated_at_trigger ON public.accounts;
CREATE TRIGGER accounts_updated_at_trigger BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE: account_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    source VARCHAR(50) DEFAULT 'auto',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_account_date UNIQUE(account_id, recorded_at)
);

ALTER TABLE public.account_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own account history" ON public.account_history;
CREATE POLICY "Users manage own account history" ON public.account_history FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_balance_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_balance IS DISTINCT FROM NEW.current_balance THEN
        INSERT INTO public.account_history (account_id, user_id, balance, recorded_at, source)
        VALUES (NEW.id, NEW.user_id, NEW.current_balance, CURRENT_DATE, 'auto')
        ON CONFLICT (account_id, recorded_at) DO UPDATE SET balance = NEW.current_balance;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS account_balance_change_trigger ON public.accounts;
CREATE TRIGGER account_balance_change_trigger AFTER UPDATE OF current_balance ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.record_balance_change();

-- ============================================================================
-- TABLE: recurring_expenses
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    billing_period TEXT NOT NULL,
    next_due_date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('subscription', 'bill')),
    is_active BOOLEAN DEFAULT true,
    service_provider TEXT,
    meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Allocation category NAME (categories are recreated every month); NULL = Subscriptions / Bills
    budget_category TEXT
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can manage own recurring expenses" ON public.recurring_expenses USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE: recurring_transfers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    source_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    destination_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    billing_period TEXT NOT NULL,
    next_transfer_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT source_dest_different CHECK (source_account_id <> destination_account_id)
);

ALTER TABLE public.recurring_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recurring transfers" ON public.recurring_transfers;
CREATE POLICY "Users can manage own recurring transfers" ON public.recurring_transfers FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_recurring_transfers_updated_at ON public.recurring_transfers;
CREATE TRIGGER update_recurring_transfers_updated_at BEFORE UPDATE ON public.recurring_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TABLE: deleted_accounts
-- ============================================================================

-- Support-only snapshot of every deleted account for manual recovery. RLS with no policies
-- blocks anon/authenticated; the SECURITY DEFINER trigger still writes it.
CREATE TABLE IF NOT EXISTS public.deleted_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type_name VARCHAR(100),
    class TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.archive_account_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type_name TEXT;
    v_class TEXT;
BEGIN
    SELECT name, class INTO v_type_name, v_class
    FROM public.account_types
    WHERE id = OLD.account_type_id;

    INSERT INTO public.deleted_accounts (user_id, account_id, name, account_type_name, class, data)
    VALUES (OLD.user_id, OLD.id, OLD.name, v_type_name, v_class, to_jsonb(OLD));

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS accounts_archive_on_delete ON public.accounts;
CREATE TRIGGER accounts_archive_on_delete
BEFORE DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.archive_account_on_delete();

-- ============================================================================
-- Indexes & Grants
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_account_types_user ON public.account_types(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_types_system ON public.account_types(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_account_types_class ON public.account_types(class);
CREATE INDEX IF NOT EXISTS idx_account_types_code ON public.account_types(code);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(account_type_id);
CREATE INDEX IF NOT EXISTS idx_accounts_sort ON public.accounts(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_account_history_account ON public.account_history(account_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_history_user_date ON public.account_history(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id ON public.recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_is_active ON public.recurring_expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_transfers_user_id ON public.recurring_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transfers_is_active ON public.recurring_transfers(is_active);

GRANT ALL ON public.account_types TO authenticated;
GRANT ALL ON public.accounts TO authenticated;
GRANT ALL ON public.account_history TO authenticated;
GRANT ALL ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_transfers TO authenticated;
