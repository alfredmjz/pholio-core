-- ============================================================================
-- Sample Data for UI Verification
-- ============================================================================
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard -> SQL Editor
-- 2. Run this script - it will use the most recent user automatically
-- 3. This script DELETES existing accounts/transactions before creating new ones
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_checking_type_id UUID;
    v_savings_type_id UUID;
    v_investment_type_id UUID;
    v_retirement_type_id UUID;
    v_credit_card_type_id UUID;
    v_auto_loan_type_id UUID;
    v_checking_account_id UUID;
    v_savings_account_id UUID;
    v_investment_account_id UUID;
    v_retirement_account_id UUID;
    v_credit_card_account_id UUID;
    v_auto_loan_account_id UUID;
BEGIN
    -- Get the most recent user (or replace with specific user ID)
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found. Please create a user first.';
    END IF;

    RAISE NOTICE 'Using user: %', v_user_id;

    -- ========================================================================
    -- DELETE EXISTING DATA (clean slate)
    -- ========================================================================
    RAISE NOTICE 'Deleting existing data...';

    DELETE FROM public.transactions WHERE user_id = v_user_id;
    DELETE FROM public.account_history WHERE user_id = v_user_id;
    DELETE FROM public.accounts WHERE user_id = v_user_id;

    RAISE NOTICE 'Existing data deleted.';

    -- Get account type IDs
    SELECT id INTO v_checking_type_id FROM public.account_types WHERE name = 'Checking Account' AND is_system = true;
    SELECT id INTO v_savings_type_id FROM public.account_types WHERE name = 'Savings Account' AND is_system = true;
    SELECT id INTO v_investment_type_id FROM public.account_types WHERE name = 'Investment Account' AND is_system = true;
    SELECT id INTO v_retirement_type_id FROM public.account_types WHERE name = 'Retirement Account' AND is_system = true;
    SELECT id INTO v_credit_card_type_id FROM public.account_types WHERE name = 'Credit Card' AND is_system = true;
    SELECT id INTO v_auto_loan_type_id FROM public.account_types WHERE name = 'Auto Loan' AND is_system = true;

    -- ========================================================================
    -- CREATE ACCOUNTS
    -- ========================================================================

    -- Checking Account (Asset)
    INSERT INTO public.accounts (user_id, name, account_type_id, institution, current_balance, target_balance, notes)
    VALUES (v_user_id, 'TD Chequing', v_checking_type_id, 'TD Bank', 5250.00, 10000.00, 'Primary checking for daily expenses')
    RETURNING id INTO v_checking_account_id;

    -- Savings Account (Asset)
    INSERT INTO public.accounts (user_id, name, account_type_id, institution, current_balance, target_balance, interest_rate, interest_type, notes)
    VALUES (v_user_id, 'EQ Bank HISA', v_savings_type_id, 'EQ Bank', 15000.00, 25000.00, 0.0475, 'compound', 'Emergency fund - high interest savings')
    RETURNING id INTO v_savings_account_id;

    -- Investment Account (Asset)
    INSERT INTO public.accounts (user_id, name, account_type_id, institution, current_balance, target_balance, notes)
    VALUES (v_user_id, 'Wealthsimple Trade', v_investment_type_id, 'Wealthsimple', 32500.00, 100000.00, 'Self-directed trading account')
    RETURNING id INTO v_investment_account_id;

    -- Retirement Account (Asset)
    INSERT INTO public.accounts (user_id, name, account_type_id, institution, current_balance, target_balance, track_contribution_room, contribution_room, annual_contribution_limit, notes)
    VALUES (v_user_id, 'TFSA', v_retirement_type_id, 'Wealthsimple', 45000.00, 250000.00, true, 25000.00, 7000.00, 'Tax-free savings account')
    RETURNING id INTO v_retirement_account_id;

    -- Credit Card (Liability)
    INSERT INTO public.accounts (user_id, name, account_type_id, institution, current_balance, credit_limit, interest_rate, interest_type, notes)
    VALUES (v_user_id, 'TD Visa Infinite', v_credit_card_type_id, 'TD Bank', 2150.00, 15000.00, 0.1999, 'compound', 'Main credit card - pay off monthly')
    RETURNING id INTO v_credit_card_account_id;

    -- Auto Loan (Liability)
    INSERT INTO public.accounts (user_id, name, account_type_id, institution, current_balance, original_amount, interest_rate, interest_type, loan_start_date, loan_term_months, notes)
    VALUES (v_user_id, 'Toyota Financing', v_auto_loan_type_id, 'Toyota Financial', 18500.00, 32000.00, 0.0499, 'simple', '2023-06-01', 60, '2023 Toyota RAV4 - 5 year term')
    RETURNING id INTO v_auto_loan_account_id;

    -- ========================================================================
    -- CREATE ACCOUNT HISTORY (for trend charts)
    -- ========================================================================

    INSERT INTO public.account_history (account_id, user_id, balance, recorded_at, source) VALUES
    -- Checking history
    (v_checking_account_id, v_user_id, 4800.00, CURRENT_DATE - INTERVAL '5 months', 'manual'),
    (v_checking_account_id, v_user_id, 5100.00, CURRENT_DATE - INTERVAL '4 months', 'manual'),
    (v_checking_account_id, v_user_id, 4950.00, CURRENT_DATE - INTERVAL '3 months', 'manual'),
    (v_checking_account_id, v_user_id, 5300.00, CURRENT_DATE - INTERVAL '2 months', 'manual'),
    (v_checking_account_id, v_user_id, 5150.00, CURRENT_DATE - INTERVAL '1 month', 'manual'),
    (v_checking_account_id, v_user_id, 5250.00, CURRENT_DATE, 'manual'),
    -- Savings history
    (v_savings_account_id, v_user_id, 12000.00, CURRENT_DATE - INTERVAL '5 months', 'manual'),
    (v_savings_account_id, v_user_id, 12500.00, CURRENT_DATE - INTERVAL '4 months', 'manual'),
    (v_savings_account_id, v_user_id, 13200.00, CURRENT_DATE - INTERVAL '3 months', 'manual'),
    (v_savings_account_id, v_user_id, 14000.00, CURRENT_DATE - INTERVAL '2 months', 'manual'),
    (v_savings_account_id, v_user_id, 14500.00, CURRENT_DATE - INTERVAL '1 month', 'manual'),
    (v_savings_account_id, v_user_id, 15000.00, CURRENT_DATE, 'manual'),
    -- Investment history
    (v_investment_account_id, v_user_id, 28000.00, CURRENT_DATE - INTERVAL '5 months', 'manual'),
    (v_investment_account_id, v_user_id, 29500.00, CURRENT_DATE - INTERVAL '4 months', 'manual'),
    (v_investment_account_id, v_user_id, 30200.00, CURRENT_DATE - INTERVAL '3 months', 'manual'),
    (v_investment_account_id, v_user_id, 31000.00, CURRENT_DATE - INTERVAL '2 months', 'manual'),
    (v_investment_account_id, v_user_id, 31800.00, CURRENT_DATE - INTERVAL '1 month', 'manual'),
    (v_investment_account_id, v_user_id, 32500.00, CURRENT_DATE, 'manual'),
    -- Retirement history
    (v_retirement_account_id, v_user_id, 38000.00, CURRENT_DATE - INTERVAL '5 months', 'manual'),
    (v_retirement_account_id, v_user_id, 40000.00, CURRENT_DATE - INTERVAL '4 months', 'manual'),
    (v_retirement_account_id, v_user_id, 41500.00, CURRENT_DATE - INTERVAL '3 months', 'manual'),
    (v_retirement_account_id, v_user_id, 43000.00, CURRENT_DATE - INTERVAL '2 months', 'manual'),
    (v_retirement_account_id, v_user_id, 44200.00, CURRENT_DATE - INTERVAL '1 month', 'manual'),
    (v_retirement_account_id, v_user_id, 45000.00, CURRENT_DATE, 'manual'),
    -- Credit card history
    (v_credit_card_account_id, v_user_id, 3200.00, CURRENT_DATE - INTERVAL '5 months', 'manual'),
    (v_credit_card_account_id, v_user_id, 2800.00, CURRENT_DATE - INTERVAL '4 months', 'manual'),
    (v_credit_card_account_id, v_user_id, 2500.00, CURRENT_DATE - INTERVAL '3 months', 'manual'),
    (v_credit_card_account_id, v_user_id, 2300.00, CURRENT_DATE - INTERVAL '2 months', 'manual'),
    (v_credit_card_account_id, v_user_id, 2100.00, CURRENT_DATE - INTERVAL '1 month', 'manual'),
    (v_credit_card_account_id, v_user_id, 2150.00, CURRENT_DATE, 'manual'),
    -- Auto loan history
    (v_auto_loan_account_id, v_user_id, 21000.00, CURRENT_DATE - INTERVAL '5 months', 'manual'),
    (v_auto_loan_account_id, v_user_id, 20500.00, CURRENT_DATE - INTERVAL '4 months', 'manual'),
    (v_auto_loan_account_id, v_user_id, 20000.00, CURRENT_DATE - INTERVAL '3 months', 'manual'),
    (v_auto_loan_account_id, v_user_id, 19500.00, CURRENT_DATE - INTERVAL '2 months', 'manual'),
    (v_auto_loan_account_id, v_user_id, 19000.00, CURRENT_DATE - INTERVAL '1 month', 'manual'),
    (v_auto_loan_account_id, v_user_id, 18500.00, CURRENT_DATE, 'manual');

    -- ========================================================================
    -- CREATE TRANSACTIONS
    -- ========================================================================

    INSERT INTO public.transactions (user_id, name, amount, transaction_date, source, notes) VALUES
    -- INCOME
    (v_user_id, 'Monthly Salary', 6500.00, CURRENT_DATE - INTERVAL '5 days', 'manual', 'December paycheck'),
    (v_user_id, 'Monthly Salary', 6500.00, CURRENT_DATE - INTERVAL '1 month' - INTERVAL '5 days', 'manual', 'November paycheck'),
    (v_user_id, 'Monthly Salary', 6500.00, CURRENT_DATE - INTERVAL '2 months' - INTERVAL '5 days', 'manual', 'October paycheck'),
    (v_user_id, 'Freelance Project', 1200.00, CURRENT_DATE - INTERVAL '10 days', 'manual', 'Side project payment'),
    (v_user_id, 'Interest Income', 58.75, CURRENT_DATE - INTERVAL '15 days', 'manual', 'EQ Bank interest'),
    (v_user_id, 'Dividend Payment', 125.00, CURRENT_DATE - INTERVAL '20 days', 'manual', 'Quarterly dividends'),
    -- EXPENSES
    (v_user_id, 'Rent Payment', -1800.00, CURRENT_DATE - INTERVAL '3 days', 'manual', 'Monthly rent'),
    (v_user_id, 'Rent Payment', -1800.00, CURRENT_DATE - INTERVAL '1 month' - INTERVAL '3 days', 'manual', 'Monthly rent'),
    (v_user_id, 'Rent Payment', -1800.00, CURRENT_DATE - INTERVAL '2 months' - INTERVAL '3 days', 'manual', 'Monthly rent'),
    (v_user_id, 'Loblaws Groceries', -156.78, CURRENT_DATE - INTERVAL '2 days', 'manual', 'Weekly groceries'),
    (v_user_id, 'Costco Trip', -287.45, CURRENT_DATE - INTERVAL '8 days', 'manual', 'Monthly bulk shopping'),
    (v_user_id, 'Netflix Subscription', -16.99, CURRENT_DATE - INTERVAL '4 days', 'manual', 'Monthly streaming'),
    (v_user_id, 'Spotify Premium', -11.99, CURRENT_DATE - INTERVAL '4 days', 'manual', 'Monthly music'),
    (v_user_id, 'Rogers Internet', -89.99, CURRENT_DATE - INTERVAL '6 days', 'manual', 'Monthly internet'),
    (v_user_id, 'Hydro Bill', -125.00, CURRENT_DATE - INTERVAL '12 days', 'manual', 'Monthly utilities'),
    (v_user_id, 'Gas Station', -78.50, CURRENT_DATE - INTERVAL '7 days', 'manual', 'Petro-Canada fill up'),
    (v_user_id, 'Car Insurance', -185.00, CURRENT_DATE - INTERVAL '1 day', 'manual', 'Monthly auto insurance'),
    (v_user_id, 'Gym Membership', -49.99, CURRENT_DATE - INTERVAL '5 days', 'manual', 'Monthly GoodLife'),
    (v_user_id, 'Restaurant Dinner', -85.00, CURRENT_DATE - INTERVAL '3 days', 'manual', 'Dinner with friends'),
    (v_user_id, 'Amazon Purchase', -67.89, CURRENT_DATE - INTERVAL '9 days', 'manual', 'Household items'),
    (v_user_id, 'Tim Hortons', -12.45, CURRENT_DATE - INTERVAL '1 day', 'manual', 'Morning coffee'),
    (v_user_id, 'Uber Ride', -24.50, CURRENT_DATE - INTERVAL '6 days', 'manual', 'Downtown trip'),
    (v_user_id, 'Phone Bill', -65.00, CURRENT_DATE - INTERVAL '11 days', 'manual', 'Monthly cellular'),
    (v_user_id, 'Loblaws Groceries', -142.34, CURRENT_DATE - INTERVAL '1 month' - INTERVAL '2 days', 'manual', NULL),
    (v_user_id, 'Gas Station', -82.00, CURRENT_DATE - INTERVAL '1 month' - INTERVAL '8 days', 'manual', NULL),
    (v_user_id, 'Restaurant', -95.00, CURRENT_DATE - INTERVAL '1 month' - INTERVAL '12 days', 'manual', NULL),
    (v_user_id, 'Hydro Bill', -118.00, CURRENT_DATE - INTERVAL '1 month' - INTERVAL '15 days', 'manual', NULL),
    (v_user_id, 'Loblaws Groceries', -168.90, CURRENT_DATE - INTERVAL '2 months' - INTERVAL '3 days', 'manual', NULL),
    (v_user_id, 'Gas Station', -75.00, CURRENT_DATE - INTERVAL '2 months' - INTERVAL '7 days', 'manual', NULL);

    RAISE NOTICE '✓ Sample data created successfully!';
    RAISE NOTICE '  Total Assets: $97,750.00';
    RAISE NOTICE '  Total Liabilities: $20,650.00';
    RAISE NOTICE '  Net Worth: $77,100.00';

END $$;

-- Verify:
SELECT 'Accounts:' as type, COUNT(*) as count FROM public.accounts WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
UNION ALL
SELECT 'History:', COUNT(*) FROM public.account_history WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
UNION ALL
SELECT 'Transactions:', COUNT(*) FROM public.transactions WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);

