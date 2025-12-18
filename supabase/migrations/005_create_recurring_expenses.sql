-- Create recurring_expenses table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'weekly', 'biweekly')),
  next_due_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('subscription', 'bill')),
  is_active BOOLEAN DEFAULT true,
  service_provider TEXT, -- 'netflix', 'spotify', 'apple', etc. for icons
  plaid_stream_id TEXT, -- Future proofing
  meta_data JSONB DEFAULT '{}'::jsonb, -- Store interest_rate, total_balance, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS "Users can manage their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can manage their own recurring expenses" ON public.recurring_expenses
  USING (auth.uid() = user_id);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_id ON public.recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_is_active ON public.recurring_expenses(is_active);

-- Grant permissions (standard for this project)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.recurring_expenses TO anon, authenticated;


-- Migration to support manual linking of transactions to recurring expenses
ALTER TABLE transactions
ADD COLUMN recurring_expense_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- Index for performance when querying linked transactions
CREATE INDEX idx_transactions_recurring_expense_id ON transactions(recurring_expense_id);
