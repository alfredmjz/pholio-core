-- ============================================================================
-- pgTAP tests for account charges (migration 012): monthly fees with a minimum-balance waiver,
-- yearly fees, catching up missed months, and per-cash-advance fees.
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

CREATE OR REPLACE FUNCTION pg_temp.make_charge(
    p_id UUID, p_account UUID, p_name TEXT, p_frequency TEXT, p_amount DECIMAL, p_rate DECIMAL,
    p_next DATE, p_waive DECIMAL
) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.account_charges (id, account_id, user_id, name, frequency, amount, rate, charge_day, next_charge_date, waive_min_balance)
    VALUES (p_id, p_account, '16000000-0000-0000-0000-000000000001', p_name, p_frequency, p_amount, p_rate,
            EXTRACT(DAY FROM p_next)::SMALLINT, p_next, p_waive);
$$;

-- Writes a ledger row the way the server actions do: insert the row, then move the balance.
CREATE OR REPLACE FUNCTION pg_temp.post(p_id UUID, p_account UUID, p_amount DECIMAL, p_date DATE, p_cash_advance BOOLEAN DEFAULT false) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.account_transactions (id, user_id, account_id, amount, transaction_type, description, transaction_date, is_cash_advance)
    VALUES (p_id, '16000000-0000-0000-0000-000000000001', p_account, p_amount, CASE WHEN p_amount < 0 THEN 'withdrawal' ELSE 'deposit' END, 'Test', p_date, p_cash_advance);
    UPDATE public.accounts SET current_balance = current_balance + p_amount WHERE id = p_account;
$$;

CREATE OR REPLACE FUNCTION pg_temp.remove(p_id UUID) RETURNS VOID
LANGUAGE sql AS $$
    UPDATE public.accounts a SET current_balance = a.current_balance - t.amount
    FROM public.account_transactions t WHERE t.id = p_id AND a.id = t.account_id;
    DELETE FROM public.account_transactions WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

CREATE OR REPLACE FUNCTION pg_temp.fees(p_account UUID) RETURNS INT
LANGUAGE sql AS $$ SELECT count(*)::INT FROM public.account_transactions WHERE account_id = p_account AND transaction_type = 'fee'; $$;

CREATE OR REPLACE FUNCTION pg_temp.next_date(p_charge UUID) RETURNS TEXT
LANGUAGE sql AS $$ SELECT next_charge_date::TEXT FROM public.account_charges WHERE id = p_charge; $$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('16000000-0000-0000-0000-000000000001', 'owner@account-charges-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- a1 chequing 5000; dips to 3000 from Oct 15 to Oct 19. Monthly fee 16.95, waived at 4000.
SELECT pg_temp.make_account('a1600000-0000-0000-0000-000000000001', 'chequing', 5000);
-- a2 chequing 5000, no activity. Same fee and waiver.
SELECT pg_temp.make_account('a1600000-0000-0000-0000-000000000002', 'chequing', 5000);
-- a3 chequing 1000. Monthly fee 4 on the 30th, no waiver, last posted before September.
SELECT pg_temp.make_account('a1600000-0000-0000-0000-000000000003', 'chequing', 1000);
-- a4 credit card 0 owed. Annual fee 120.
SELECT pg_temp.make_account('a1600000-0000-0000-0000-000000000004', 'credit_card', 0);
-- a5 credit card 100 owed, limit 5000. Cash advance fee: 5%, at least 3.50.
SELECT pg_temp.make_account('a1600000-0000-0000-0000-000000000005', 'credit_card', 100);
UPDATE public.accounts SET credit_limit = 5000 WHERE id = 'a1600000-0000-0000-0000-000000000005';
-- a6 credit card 950 owed, limit 1000, over-limit fee 29. Same cash advance fee.
SELECT pg_temp.make_account('a1600000-0000-0000-0000-000000000006', 'credit_card', 950);
UPDATE public.accounts SET credit_limit = 1000, over_limit_fee = 29 WHERE id = 'a1600000-0000-0000-0000-000000000006';

SELECT pg_temp.make_charge('f1600000-0000-0000-0000-000000000001', 'a1600000-0000-0000-0000-000000000001', 'Monthly account fee', 'monthly', 16.95, NULL, '2026-11-01', 4000);
SELECT pg_temp.make_charge('f1600000-0000-0000-0000-000000000002', 'a1600000-0000-0000-0000-000000000002', 'Monthly account fee', 'monthly', 16.95, NULL, '2026-11-01', 4000);
SELECT pg_temp.make_charge('f1600000-0000-0000-0000-000000000003', 'a1600000-0000-0000-0000-000000000003', 'Account fee', 'monthly', 4, NULL, '2026-08-31', NULL);
SELECT pg_temp.make_charge('f1600000-0000-0000-0000-000000000004', 'a1600000-0000-0000-0000-000000000004', 'Annual fee', 'yearly', 120, NULL, '2026-11-01', NULL);
SELECT pg_temp.make_charge('f1600000-0000-0000-0000-000000000005', 'a1600000-0000-0000-0000-000000000005', 'Cash advance fee', 'cash_advance', 3.50, 0.05, NULL, NULL);
SELECT pg_temp.make_charge('f1600000-0000-0000-0000-000000000006', 'a1600000-0000-0000-0000-000000000006', 'Cash advance fee', 'cash_advance', 3.50, 0.05, NULL, NULL);

SELECT set_config('request.jwt.claims', json_build_object('sub', '16000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

SELECT pg_temp.post('d1600000-0000-0000-0000-000000000001', 'a1600000-0000-0000-0000-000000000001', -2000, '2026-10-15');
SELECT pg_temp.post('d1600000-0000-0000-0000-000000000002', 'a1600000-0000-0000-0000-000000000001', 2000, '2026-10-20');

-- ---------------------------------------------------------------------------
-- Constraints and access
-- ---------------------------------------------------------------------------
SELECT throws_ok(
    $$SELECT pg_temp.make_charge(gen_random_uuid(), 'a1600000-0000-0000-0000-000000000004', 'Bad', 'yearly', 10, NULL, '2026-11-01', 100)$$,
    '23514', NULL, 'only a monthly charge can have a waiver'
);
SELECT throws_ok(
    $$SELECT pg_temp.make_charge(gen_random_uuid(), 'a1600000-0000-0000-0000-000000000004', 'Bad', 'monthly', 10, NULL, NULL, NULL)$$,
    '23514', NULL, 'a monthly charge needs its next date'
);
SELECT throws_ok(
    $$SELECT public.post_due_account_charges('2026-11-01')$$,
    '42501', NULL, 'signed-in users cannot run the posting job'
);

-- ---------------------------------------------------------------------------
-- Monthly fee with a minimum-balance waiver
-- ---------------------------------------------------------------------------
SELECT is(
    public.lowest_daily_balance('a1600000-0000-0000-0000-000000000001', '2026-10-01', '2026-10-31'),
    3000.00, 'October closed at 5000 every day except Oct 15-19, at 3000'
);

RESET ROLE;
SELECT is(public.post_due_account_charges('2026-11-01'), 5, 'Nov 1 posts a1''s fee, a3''s three missed fees and a4''s annual fee');

SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000001'), 4983.05, 'a1 dipped to 3000, below 4000: 5000 - 16.95 = 4983.05');
SELECT is(
    (SELECT amount || ' ' || description || ' ' || transaction_date FROM public.account_transactions WHERE charge_id = 'f1600000-0000-0000-0000-000000000001'),
    '-16.95 Monthly account fee 2026-11-01', 'the fee row is -16.95, named after the charge, dated Nov 1'
);
SELECT is(pg_temp.next_date('f1600000-0000-0000-0000-000000000001'), '2026-12-01', 'a1''s next fee is Dec 1');

SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000002'), 5000.00, 'a2 stayed at 5000, above 4000: waived');
SELECT is(pg_temp.fees('a1600000-0000-0000-0000-000000000002'), 0, 'a waived month posts no row');
SELECT is(pg_temp.next_date('f1600000-0000-0000-0000-000000000002'), '2026-12-01', 'a waived month still moves to Dec 1');

-- ---------------------------------------------------------------------------
-- Catching up missed months, and month-end days
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000003'), 988.00, 'Aug 31, Sep 30 and Oct 31 were all due: 1000 - 3 x 4 = 988');
SELECT is(
    (SELECT string_agg(transaction_date::TEXT, ' ' ORDER BY transaction_date) FROM public.account_transactions WHERE charge_id = 'f1600000-0000-0000-0000-000000000003'),
    '2026-08-31 2026-09-30 2026-10-31', 'a charge on the 31st posts on the last day of shorter months and returns to the 31st'
);
SELECT is(pg_temp.next_date('f1600000-0000-0000-0000-000000000003'), '2026-11-30', 'a3''s next fee is Nov 30');

SELECT is(public.post_due_account_charges('2026-11-01'), 0, 'running again the same day posts nothing');
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000001'), 4983.05, 'a1 is charged once');

-- ---------------------------------------------------------------------------
-- Yearly fee on a credit card
-- ---------------------------------------------------------------------------
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000004'), 120.00, 'the 120 annual fee adds to the debt: 0 + 120');
SELECT is(pg_temp.next_date('f1600000-0000-0000-0000-000000000004'), '2027-11-01', 'the next annual fee is a year later');

-- ---------------------------------------------------------------------------
-- Cash advance fees: 5% of the advance, at least 3.50
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;

SELECT pg_temp.post('d1600000-0000-0000-0000-000000000011', 'a1600000-0000-0000-0000-000000000005', 200, '2026-10-25', true);
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000005'), 310.00, '5% of 200 is 10, above 3.50: 100 + 200 + 10 = 310');
SELECT is(
    (SELECT amount || ' ' || description || ' ' || transaction_date FROM public.account_transactions WHERE fee_for_transaction_id = 'd1600000-0000-0000-0000-000000000011'),
    '10.00 Cash advance fee 2026-10-25', 'the fee row is 10, named after the charge, on the advance date'
);

SELECT pg_temp.post('d1600000-0000-0000-0000-000000000012', 'a1600000-0000-0000-0000-000000000005', 50, '2026-10-26', true);
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000005'), 363.50, '5% of 50 is 2.50, below 3.50: 310 + 50 + 3.50 = 363.50');

SELECT pg_temp.post('d1600000-0000-0000-0000-000000000013', 'a1600000-0000-0000-0000-000000000005', 100, '2026-10-27');
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000005'), 463.50, 'a purchase that is not a cash advance charges nothing');

SELECT pg_temp.remove('d1600000-0000-0000-0000-000000000011');
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000005'), 253.50, 'removing the 200 advance gives back 200 and its 10 fee');
SELECT is(pg_temp.fees('a1600000-0000-0000-0000-000000000005'), 1, 'only the 3.50 fee remains');

UPDATE public.account_charges SET is_active = false WHERE id = 'f1600000-0000-0000-0000-000000000005';
SELECT pg_temp.post('d1600000-0000-0000-0000-000000000014', 'a1600000-0000-0000-0000-000000000005', 100, '2026-10-28', true);
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000005'), 353.50, 'a removed charge posts nothing: 253.50 + 100');

SELECT pg_temp.post('d1600000-0000-0000-0000-000000000015', 'a1600000-0000-0000-0000-000000000006', 100, '2026-10-25', true);
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000006'), 1084.00, 'past the limit both post: 950 + 100 + 29 over-limit + 5 cash advance = 1084');
SELECT is(pg_temp.fees('a1600000-0000-0000-0000-000000000006'), 2, 'one over-limit fee and one cash advance fee');

SELECT pg_temp.remove('d1600000-0000-0000-0000-000000000015');
SELECT is(pg_temp.balance('a1600000-0000-0000-0000-000000000006'), 950.00, 'removing the advance reverses both fees');

SELECT * FROM finish();
ROLLBACK;
