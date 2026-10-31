-- ============================================================================
-- pgTAP tests for interest posting (migration 014): 3-decimal rates and one interest row per
-- account per month.
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.make_account(p_id UUID, p_code TEXT, p_balance DECIMAL) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance)
    SELECT p_id, '16000000-0000-0000-0000-000000000001', p_code, t.id, p_balance
    FROM public.account_types t
    WHERE t.code = p_code AND t.user_id IS NULL
    LIMIT 1;
$$;

-- Posts an interest row the way the monthly job does.
CREATE OR REPLACE FUNCTION pg_temp.post_interest(p_account UUID, p_amount DECIMAL, p_period DATE) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, interest_period)
    VALUES ('16000000-0000-0000-0000-000000000001', p_account, p_amount, 'interest', 'Monthly compound interest', p_period, p_period);
$$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('16000000-0000-0000-0000-000000000001', 'owner@interest-posting-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- m1 mortgage 400,000 at 4.125%
SELECT pg_temp.make_account('c1600000-0000-0000-0000-000000000001', 'mortgage', 400000);
UPDATE public.accounts SET interest_rate = 0.04125 WHERE id = 'c1600000-0000-0000-0000-000000000001';
-- s1 savings 10,000, overdraft interest 19.875%
SELECT pg_temp.make_account('c1600000-0000-0000-0000-000000000002', 'savings', 10000);
UPDATE public.accounts SET overdraft_protection = true, overdraft_interest_rate = 0.19875 WHERE id = 'c1600000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- Rates keep 3 decimals of a percent
-- ---------------------------------------------------------------------------
SELECT is((SELECT interest_rate FROM public.accounts WHERE id = 'c1600000-0000-0000-0000-000000000001'), 0.04125,
    '4.125% is stored as 0.04125, not rounded to 4.13%');
SELECT is((SELECT overdraft_interest_rate FROM public.accounts WHERE id = 'c1600000-0000-0000-0000-000000000002'), 0.19875,
    'a 19.875% overdraft rate is stored as 0.19875');

-- ---------------------------------------------------------------------------
-- One interest row per account per month
-- ---------------------------------------------------------------------------
SELECT lives_ok($$ SELECT pg_temp.post_interest('c1600000-0000-0000-0000-000000000002', 25.00, '2026-11-01') $$,
    'the first November interest row posts');
SELECT throws_ok($$ SELECT pg_temp.post_interest('c1600000-0000-0000-0000-000000000002', 25.00, '2026-11-01') $$,
    '23505', NULL, 'a second November row for the same account is rejected');
SELECT lives_ok($$ SELECT pg_temp.post_interest('c1600000-0000-0000-0000-000000000002', 25.05, '2026-12-01') $$,
    'December posts separately');
SELECT lives_ok($$ SELECT pg_temp.post_interest('c1600000-0000-0000-0000-000000000001', 1375.00, '2026-11-01') $$,
    'another account posts its own November row');

INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date)
VALUES ('16000000-0000-0000-0000-000000000001', 'c1600000-0000-0000-0000-000000000002', 3.00, 'interest', 'Bonus interest', '2026-11-15'),
       ('16000000-0000-0000-0000-000000000001', 'c1600000-0000-0000-0000-000000000002', 2.00, 'interest', 'Bonus interest', '2026-11-20');
SELECT is(
    (SELECT count(*)::INT FROM public.account_transactions
     WHERE account_id = 'c1600000-0000-0000-0000-000000000002' AND transaction_type = 'interest'),
    4, 'interest rows entered by hand have no period and are not limited'
);

SELECT * FROM finish();
ROLLBACK;
