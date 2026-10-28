-- ============================================================================
-- pgTAP tests for posting recurring payments to their account (migration 010).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- A recurring payment is inserted the way payRecurringExpense and the auto-pay sync insert it:
-- one negative budget row with source 'recurring' and a recurring_expense_id.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.make_account(p_id UUID, p_user UUID, p_code TEXT, p_balance DECIMAL) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance)
    SELECT p_id, p_user, p_code, t.id, p_balance
    FROM public.account_types t
    WHERE t.code = p_code AND t.user_id IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.make_bill(p_id UUID, p_user UUID, p_name TEXT, p_amount DECIMAL, p_account UUID) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.recurring_expenses (id, user_id, name, amount, billing_period, next_due_date, category, account_id)
    VALUES (p_id, p_user, p_name, p_amount, '1:months', '2026-10-05', 'bill', p_account);
$$;

CREATE OR REPLACE FUNCTION pg_temp.pay(p_tx UUID, p_bill UUID, p_amount DECIMAL, p_date DATE) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source, recurring_expense_id)
    SELECT p_tx, auth.uid(), r.name, -ABS(p_amount), p_date, 'recurring', r.id FROM public.recurring_expenses r WHERE r.id = p_bill;
$$;

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

CREATE OR REPLACE FUNCTION pg_temp.ledger_rows(p_account UUID) RETURNS INT
LANGUAGE sql AS $$ SELECT count(*)::INT FROM public.account_transactions WHERE account_id = p_account; $$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
    ('88888888-0000-0000-0000-000000000001', 'owner@recurring-posting-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    ('88888888-0000-0000-0000-000000000002', 'other@recurring-posting-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- c8..01 chequing 100, c8..02 credit card 400 debt, c8..03 savings 300 (inactive), c8..04 other user's chequing 1000
SELECT pg_temp.make_account('c8000000-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'chequing', 100);
SELECT pg_temp.make_account('c8000000-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000001', 'credit_card', 400);
SELECT pg_temp.make_account('c8000000-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000001', 'savings', 300);
UPDATE public.accounts SET is_active = false WHERE id = 'c8000000-0000-0000-0000-000000000003';
SELECT pg_temp.make_account('c8000000-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000002', 'chequing', 1000);

-- b8..01 phone 60 on chequing, b8..02 streaming 15 on the card, b8..03 gym 40 with no account,
-- b8..04 rent 500 on the inactive savings, b8..05 a bill pointing at the other user's chequing
SELECT pg_temp.make_bill('b8000000-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001', 'Phone', 60, 'c8000000-0000-0000-0000-000000000001');
SELECT pg_temp.make_bill('b8000000-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000001', 'Streaming', 15, 'c8000000-0000-0000-0000-000000000002');
SELECT pg_temp.make_bill('b8000000-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000001', 'Gym', 40, NULL);
SELECT pg_temp.make_bill('b8000000-0000-0000-0000-000000000004', '88888888-0000-0000-0000-000000000001', 'Rent', 500, 'c8000000-0000-0000-0000-000000000003');
SELECT pg_temp.make_bill('b8000000-0000-0000-0000-000000000005', '88888888-0000-0000-0000-000000000001', 'Sneaky', 25, 'c8000000-0000-0000-0000-000000000004');

SELECT set_config('request.jwt.claims', json_build_object('sub', '88888888-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Asset: a withdrawal, linked both ways
-- ---------------------------------------------------------------------------
SELECT pg_temp.pay('d8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 60, '2026-10-05');
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000001'), 40.00, 'paying the phone bill takes 60 from chequing (100 - 60)');
SELECT is(
    (SELECT amount FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd8000000-0000-0000-0000-000000000001'),
    -60.00, 'the chequing ledger row is -60'
);
SELECT is(
    (SELECT transaction_type FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd8000000-0000-0000-0000-000000000001'),
    'withdrawal', 'the chequing ledger row is a withdrawal'
);
SELECT is(
    (SELECT description || ' ' || transaction_date FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd8000000-0000-0000-0000-000000000001'),
    'Phone 2026-10-05', 'the ledger row takes the bill name and payment date'
);
SELECT is(
    (SELECT t.linked_account_transaction_id FROM public.transactions t WHERE t.id = 'd8000000-0000-0000-0000-000000000001'),
    (SELECT id FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd8000000-0000-0000-0000-000000000001'),
    'the budget row links to its ledger row'
);

-- ---------------------------------------------------------------------------
-- Caps do not apply: the next payment takes chequing below zero
-- ---------------------------------------------------------------------------
SELECT pg_temp.pay('d8000000-0000-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000001', 60, '2026-11-05');
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000001'), -20.00, 'a payment past the balance still posts (40 - 60)');
SELECT is(pg_temp.ledger_rows('c8000000-0000-0000-0000-000000000001'), 2, 'chequing has one row per payment');

-- ---------------------------------------------------------------------------
-- Liability: the charge adds to the debt
-- ---------------------------------------------------------------------------
SELECT pg_temp.pay('d8000000-0000-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000002', 15, '2026-10-12');
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000002'), 415.00, 'a subscription on the card adds 15 to the debt (400 + 15)');
SELECT is(
    (SELECT amount || ' ' || transaction_type FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd8000000-0000-0000-0000-000000000003'),
    '15.00 adjustment', 'the card ledger row is a +15 adjustment'
);

-- ---------------------------------------------------------------------------
-- Nothing posts without a usable account
-- ---------------------------------------------------------------------------
SELECT pg_temp.pay('d8000000-0000-0000-0000-000000000004', 'b8000000-0000-0000-0000-000000000003', 40, '2026-10-01');
SELECT is(
    (SELECT linked_account_transaction_id FROM public.transactions WHERE id = 'd8000000-0000-0000-0000-000000000004'),
    NULL, 'a bill with no account records only the budget row'
);

SELECT pg_temp.pay('d8000000-0000-0000-0000-000000000005', 'b8000000-0000-0000-0000-000000000004', 500, '2026-10-01');
SELECT is(pg_temp.ledger_rows('c8000000-0000-0000-0000-000000000003'), 0, 'an inactive account gets no ledger row');
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000003'), 300.00, 'an inactive account keeps its balance');

SELECT pg_temp.pay('d8000000-0000-0000-0000-000000000006', 'b8000000-0000-0000-0000-000000000005', 25, '2026-10-01');
SELECT is(
    (SELECT count(*)::INT FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd8000000-0000-0000-0000-000000000006'),
    0, 'a bill pointing at another user''s account posts nothing'
);
RESET ROLE;
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000004'), 1000.00, 'the other user''s balance is untouched');
SET LOCAL ROLE authenticated;

-- A plain expense with a recurring-less budget row is left to createUnifiedTransaction.
INSERT INTO public.transactions (id, user_id, name, amount, transaction_date)
VALUES ('d8000000-0000-0000-0000-000000000007', auth.uid(), 'Coffee', -5, '2026-10-02');
SELECT is(
    (SELECT linked_account_transaction_id FROM public.transactions WHERE id = 'd8000000-0000-0000-0000-000000000007'),
    NULL, 'a non-recurring budget row is not posted'
);

-- ---------------------------------------------------------------------------
-- The posted payment edits and deletes like any linked transaction
-- ---------------------------------------------------------------------------
SELECT ok(
    public.update_unified_transaction('d8000000-0000-0000-0000-000000000003',
        '{"description": "Streaming", "amount": 20, "date": "2026-10-12", "type": "expense", "accountId": "c8000000-0000-0000-0000-000000000002"}'::jsonb),
    'editing the card payment succeeds'
);
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000002'), 420.00, 'raising the payment to 20 moves the debt to 420');

SELECT ok(public.delete_unified_transaction('d8000000-0000-0000-0000-000000000002'), 'deleting the second phone payment succeeds');
SELECT is(pg_temp.balance('c8000000-0000-0000-0000-000000000001'), 40.00, 'deleting it gives chequing its 60 back (-20 + 60)');
SELECT is(pg_temp.ledger_rows('c8000000-0000-0000-0000-000000000001'), 1, 'its ledger row is gone');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
