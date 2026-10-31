-- ============================================================================
-- pgTAP tests for overdraft, NSF and over-limit fees (migration 012).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- pg_temp.post() writes a ledger row the way the server actions do: insert the row, then move the
-- balance by its amount.
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
    SELECT p_id, '15000000-0000-0000-0000-000000000001', p_code, t.id, p_balance
    FROM public.account_types t
    WHERE t.code = p_code AND t.user_id IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.post(p_id UUID, p_account UUID, p_amount DECIMAL, p_type TEXT) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.account_transactions (id, user_id, account_id, amount, transaction_type, description, transaction_date)
    VALUES (p_id, auth.uid(), p_account, p_amount, p_type, 'Test', '2026-10-20');
    UPDATE public.accounts SET current_balance = current_balance + p_amount WHERE id = p_account;
$$;

-- Deletes a ledger row the way deleteAccountTransaction does: reverse its amount, then delete it.
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

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('15000000-0000-0000-0000-000000000001', 'owner@overdraft-fees-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- c1 chequing 20, NSF 45, no protection
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000001', 'chequing', 20);
UPDATE public.accounts SET nsf_fee = 45 WHERE id = 'c1500000-0000-0000-0000-000000000001';
-- c2 chequing 100, protection to -200, overdraft fee 5, NSF 48
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000002', 'chequing', 100);
UPDATE public.accounts SET overdraft_protection = true, overdraft_limit = 200, overdraft_fee = 5, nsf_fee = 48
WHERE id = 'c1500000-0000-0000-0000-000000000002';
-- c3 credit card 950 owed, limit 1000, over-limit fee 29
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000003', 'credit_card', 950);
UPDATE public.accounts SET credit_limit = 1000, over_limit_fee = 29 WHERE id = 'c1500000-0000-0000-0000-000000000003';
-- c4 chequing 10, no fees set
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000004', 'chequing', 10);
-- c5 chequing 0, protection to -100, overdraft fee 5, NSF 48
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000005', 'chequing', 0);
UPDATE public.accounts SET overdraft_protection = true, overdraft_limit = 100, overdraft_fee = 5, nsf_fee = 48
WHERE id = 'c1500000-0000-0000-0000-000000000005';
-- c6 credit card 900 owed, limit 1000, over-limit fee 29
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000006', 'credit_card', 900);
UPDATE public.accounts SET credit_limit = 1000, over_limit_fee = 29 WHERE id = 'c1500000-0000-0000-0000-000000000006';
-- c7 chequing 20, NSF 45, pays the phone bill
SELECT pg_temp.make_account('c1500000-0000-0000-0000-000000000007', 'chequing', 20);
UPDATE public.accounts SET nsf_fee = 45 WHERE id = 'c1500000-0000-0000-0000-000000000007';
INSERT INTO public.recurring_expenses (id, user_id, name, amount, billing_period, next_due_date, category, account_id)
VALUES ('b1500000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'Phone', 60, '1:months', '2026-10-05', 'bill', 'c1500000-0000-0000-0000-000000000007');

SELECT set_config('request.jwt.claims', json_build_object('sub', '15000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- NSF without protection: one fee per payment that lands below zero
-- ---------------------------------------------------------------------------
SELECT pg_temp.post('d1500000-0000-0000-0000-000000000001', 'c1500000-0000-0000-0000-000000000001', -60, 'withdrawal');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000001'), -85.00, '20 - 60 = -40, then a 45 NSF fee: -85');
SELECT is(
    (SELECT amount || ' ' || description || ' ' || transaction_date FROM public.account_transactions WHERE fee_for_transaction_id = 'd1500000-0000-0000-0000-000000000001'),
    '-45.00 NSF fee 2026-10-20', 'the fee row is -45, "NSF fee", on the payment date'
);

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000002', 'c1500000-0000-0000-0000-000000000001', -10, 'withdrawal');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000001'), -140.00, 'a second payment while overdrawn: -85 - 10 - 45 = -140');
SELECT is(pg_temp.fees('c1500000-0000-0000-0000-000000000001'), 2, 'two payments, two fees');

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000003', 'c1500000-0000-0000-0000-000000000001', 200, 'deposit');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000001'), 60.00, 'a deposit charges nothing: -140 + 200 = 60');
SELECT is(pg_temp.fees('c1500000-0000-0000-0000-000000000001'), 2, 'still two fees');

-- ---------------------------------------------------------------------------
-- Deleting a payment reverses its fee; deleting a fee on its own reverses only the fee
-- ---------------------------------------------------------------------------
SELECT pg_temp.remove('d1500000-0000-0000-0000-000000000001');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000001'), 165.00, 'removing the 60 payment gives back 60 and its 45 fee: 60 + 60 + 45 = 165');
SELECT is(pg_temp.fees('c1500000-0000-0000-0000-000000000001'), 1, 'its fee row is gone');

SELECT pg_temp.remove((SELECT id FROM public.account_transactions WHERE fee_for_transaction_id = 'd1500000-0000-0000-0000-000000000002'));
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000001'), 210.00, 'removing a waived 45 fee: 165 + 45 = 210');
SELECT is(
    (SELECT count(*)::INT FROM public.account_transactions WHERE id = 'd1500000-0000-0000-0000-000000000002'),
    1, 'the payment the waived fee belonged to stays'
);

-- ---------------------------------------------------------------------------
-- Overdraft protection: overdraft fee within the limit, NSF fee past it
-- ---------------------------------------------------------------------------
SELECT pg_temp.post('d1500000-0000-0000-0000-000000000004', 'c1500000-0000-0000-0000-000000000002', -150, 'withdrawal');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000002'), -55.00, '100 - 150 = -50, within the 200 overdraft: 5 fee, -55');
SELECT is(
    (SELECT description FROM public.account_transactions WHERE fee_for_transaction_id = 'd1500000-0000-0000-0000-000000000004'),
    'Overdraft fee', 'within the overdraft it is an overdraft fee'
);

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000005', 'c1500000-0000-0000-0000-000000000002', -200, 'withdrawal');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000002'), -303.00, '-55 - 200 = -255, past -200: 48 NSF fee, -303');
SELECT is(
    (SELECT description FROM public.account_transactions WHERE fee_for_transaction_id = 'd1500000-0000-0000-0000-000000000005'),
    'NSF fee', 'past the overdraft limit it is an NSF fee'
);

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000006', 'c1500000-0000-0000-0000-000000000005', -100, 'withdrawal');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000005'), -105.00, 'landing exactly on the -100 limit is still the overdraft fee: -105');

-- ---------------------------------------------------------------------------
-- Credit card past its limit
-- ---------------------------------------------------------------------------
SELECT pg_temp.post('d1500000-0000-0000-0000-000000000007', 'c1500000-0000-0000-0000-000000000003', 60, 'adjustment');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000003'), 1039.00, '950 + 60 = 1010, past 1000: 29 over-limit fee, 1039');
SELECT is(
    (SELECT amount || ' ' || description FROM public.account_transactions WHERE fee_for_transaction_id = 'd1500000-0000-0000-0000-000000000007'),
    '29.00 Over-limit fee', 'the over-limit fee adds 29 to the debt'
);

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000008', 'c1500000-0000-0000-0000-000000000006', 100, 'adjustment');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000006'), 1000.00, 'reaching the limit exactly charges nothing');

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000009', 'c1500000-0000-0000-0000-000000000003', 5, 'interest');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000003'), 1044.00, 'interest past the limit charges no fee: 1039 + 5');

SELECT pg_temp.post('d1500000-0000-0000-0000-000000000010', 'c1500000-0000-0000-0000-000000000003', -100, 'payment');
SELECT is(pg_temp.fees('c1500000-0000-0000-0000-000000000003'), 1, 'a payment that lowers the debt charges nothing');

-- ---------------------------------------------------------------------------
-- No fee terms, and balance edits with no ledger row
-- ---------------------------------------------------------------------------
SELECT pg_temp.post('d1500000-0000-0000-0000-000000000011', 'c1500000-0000-0000-0000-000000000004', -30, 'withdrawal');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000004'), -20.00, 'no fee terms: 10 - 30 = -20 and nothing else');

UPDATE public.accounts SET current_balance = -500 WHERE id = 'c1500000-0000-0000-0000-000000000001';
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000001'), -500.00, 'editing the balance directly charges no fee');

-- ---------------------------------------------------------------------------
-- A linked recurring payment (migration 010) that overdraws its account
-- ---------------------------------------------------------------------------
INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source, recurring_expense_id)
VALUES ('e1500000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'Phone', -60, '2026-10-05', 'recurring', 'b1500000-0000-0000-0000-000000000001');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000007'), -85.00, 'auto-pay of 60 from 20: -40, then the 45 NSF fee: -85');
SELECT is(
    (SELECT f.transaction_date::TEXT FROM public.account_transactions f
     JOIN public.account_transactions p ON p.id = f.fee_for_transaction_id
     WHERE p.linked_allocation_transaction_id = 'e1500000-0000-0000-0000-000000000001'),
    '2026-10-05', 'the fee hangs off the bill payment and takes its date'
);

SELECT ok(public.delete_unified_transaction('e1500000-0000-0000-0000-000000000001'), 'the bill payment deletes');
SELECT is(pg_temp.balance('c1500000-0000-0000-0000-000000000007'), 20.00, 'deleting it gives back the 60 and the 45 fee');
SELECT is(pg_temp.fees('c1500000-0000-0000-0000-000000000007'), 0, 'no fee rows remain');

SELECT * FROM finish();
ROLLBACK;
