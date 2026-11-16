-- ============================================================================
-- pgTAP tests for bills that pay down a debt (migration 020).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- An occurrence is inserted the way payRecurringExpense and the auto-post sync insert a bill:
-- one -amount budget row with source 'recurring' and a recurring_expense_id.
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
    SELECT p_id, '77777777-0000-0000-0000-000000000001', p_code, t.id, p_balance
    FROM public.account_types t
    WHERE t.code = p_code AND t.user_id IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.make_item(p_id UUID, p_category TEXT, p_amount DECIMAL, p_from UUID, p_to UUID) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.recurring_expenses (id, user_id, name, amount, billing_period, next_due_date, category, account_id, to_account_id)
    VALUES (p_id, '77777777-0000-0000-0000-000000000001', 'Item ' || p_amount, p_amount, '1:months', '2026-11-01', p_category, p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION pg_temp.run(p_tx UUID, p_item UUID, p_date DATE) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, covers_due_date, source, recurring_expense_id)
    SELECT p_tx, auth.uid(), r.name, -ABS(r.amount), p_date, p_date, 'recurring', r.id FROM public.recurring_expenses r WHERE r.id = p_item;
$$;

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

CREATE OR REPLACE FUNCTION pg_temp.leg(p_tx UUID, p_account UUID) RETURNS TEXT
LANGUAGE sql AS $$
    SELECT amount || ' ' || transaction_type FROM public.account_transactions
    WHERE linked_allocation_transaction_id = p_tx AND account_id = p_account;
$$;

CREATE OR REPLACE FUNCTION pg_temp.legs(p_tx UUID) RETURNS INT
LANGUAGE sql AS $$ SELECT count(*)::INT FROM public.account_transactions WHERE linked_allocation_transaction_id = p_tx; $$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('77777777-0000-0000-0000-000000000001', 'owner@bill-pays-down-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- a7..01 chequing 5000, a7..02 mortgage 200000 owed, a7..03 line of credit 500 owed, a7..04 savings 1000
SELECT pg_temp.make_account('a7000000-0000-0000-0000-000000000001', 'chequing', 5000);
SELECT pg_temp.make_account('a7000000-0000-0000-0000-000000000002', 'mortgage', 200000);
SELECT pg_temp.make_account('a7000000-0000-0000-0000-000000000003', 'line_of_credit', 500);
SELECT pg_temp.make_account('a7000000-0000-0000-0000-000000000004', 'savings', 1000);

-- b7..01 bill 1500 chequing -> mortgage, b7..02 bill 300 no account -> mortgage,
-- b7..03 bill 50 chequing -> savings (not a debt), b7..04 subscription 20 chequing -> mortgage,
-- b7..05 bill 100 line of credit -> mortgage
SELECT pg_temp.make_item('b7000000-0000-0000-0000-000000000001', 'bill', 1500, 'a7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002');
SELECT pg_temp.make_item('b7000000-0000-0000-0000-000000000002', 'bill', 300, NULL, 'a7000000-0000-0000-0000-000000000002');
SELECT pg_temp.make_item('b7000000-0000-0000-0000-000000000003', 'bill', 50, 'a7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000004');
SELECT pg_temp.make_item('b7000000-0000-0000-0000-000000000004', 'subscription', 20, 'a7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002');
SELECT pg_temp.make_item('b7000000-0000-0000-0000-000000000005', 'bill', 100, 'a7000000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000002');

SELECT set_config('request.jwt.claims', json_build_object('sub', '77777777-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Paid from chequing, pays down the mortgage
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', '2026-11-01');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000001'), 3500.00, 'the mortgage bill takes 1500 from chequing (5000 - 1500)');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 198500.00, 'and lowers the mortgage by 1500 (200000 - 1500)');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001'), '-1500.00 payment', 'the chequing leg is a -1500 payment');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002'), '-1500.00 payment', 'the mortgage leg is a -1500 payment');
SELECT is(
    (SELECT amount || ' ' || source FROM public.transactions WHERE id = 'd7000000-0000-0000-0000-000000000001'),
    '-1500.00 recurring', 'the budget row stays a 1500 expense, so it counts in the budget'
);
SELECT is(
    (SELECT t.linked_account_transaction_id FROM public.transactions t WHERE t.id = 'd7000000-0000-0000-0000-000000000001'),
    (SELECT id FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd7000000-0000-0000-0000-000000000001' AND account_id = 'a7000000-0000-0000-0000-000000000001'),
    'the budget row links to the chequing leg'
);
SELECT is(
    (SELECT f.linked_transfer_transaction_id = t.id AND t.linked_transfer_transaction_id = f.id
     FROM public.account_transactions f
     JOIN public.account_transactions t ON t.linked_allocation_transaction_id = f.linked_allocation_transaction_id AND t.id <> f.id
     WHERE f.linked_allocation_transaction_id = 'd7000000-0000-0000-0000-000000000001' AND f.account_id = 'a7000000-0000-0000-0000-000000000001'),
    true, 'the two legs link to each other'
);

-- ---------------------------------------------------------------------------
-- No paid-from account: only the debt leg
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000002', '2026-11-02');
SELECT is(pg_temp.legs('d7000000-0000-0000-0000-000000000002'), 1, 'a bill with no paid-from account posts one leg');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002'), '-300.00 payment', 'it is a -300 payment on the mortgage');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 198200.00, 'the mortgage drops by 300 (198500 - 300)');

-- ---------------------------------------------------------------------------
-- Only debts are paid down, and only by bills
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d7000000-0000-0000-0000-000000000003', 'b7000000-0000-0000-0000-000000000003', '2026-11-03');
SELECT is(pg_temp.legs('d7000000-0000-0000-0000-000000000003'), 1, 'a bill pointing at savings posts only its paid-from leg');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000001'), '-50.00 withdrawal', 'which stays a plain withdrawal');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000004'), 1000.00, 'savings is untouched');

SELECT pg_temp.run('d7000000-0000-0000-0000-000000000004', 'b7000000-0000-0000-0000-000000000004', '2026-11-04');
SELECT is(pg_temp.legs('d7000000-0000-0000-0000-000000000004'), 1, 'a subscription never pays down a debt');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 198200.00, 'the mortgage is untouched by the subscription');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000001'), 3430.00, 'chequing paid the 50 bill and 20 subscription (3500 - 70)');

-- ---------------------------------------------------------------------------
-- Paid from a line of credit: draws on it, pays down the mortgage
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d7000000-0000-0000-0000-000000000005', 'b7000000-0000-0000-0000-000000000005', '2026-11-05');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000005', 'a7000000-0000-0000-0000-000000000003'), '100.00 adjustment', 'the line of credit leg adds 100 to its debt');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000003'), 600.00, 'the line of credit owes 600 (500 + 100)');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 198100.00, 'the mortgage drops by 100 (198200 - 100)');

-- ---------------------------------------------------------------------------
-- Editing keeps both legs in step
-- ---------------------------------------------------------------------------
SELECT ok(
    public.update_unified_transaction('d7000000-0000-0000-0000-000000000001',
        '{"description": "Mortgage", "amount": 1600, "date": "2026-11-01", "type": "expense",
          "accountId": "a7000000-0000-0000-0000-000000000001"}'::jsonb),
    'raising the mortgage bill to 1600 succeeds'
);
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000001'), 3330.00, 'chequing pays 100 more (3430 + 1500 - 1600)');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 198000.00, 'the mortgage drops 100 more (198100 + 1500 - 1600)');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001'), '-1600.00 payment', 'the chequing leg keeps its payment type');
SELECT is(pg_temp.leg('d7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002'), '-1600.00 payment', 'the mortgage leg follows the new amount');

SELECT ok(
    public.update_unified_transaction('d7000000-0000-0000-0000-000000000002',
        '{"description": "Item 300", "amount": 350, "date": "2026-11-02", "type": "expense"}'::jsonb),
    'raising the no-account bill to 350 succeeds'
);
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 197950.00, 'the mortgage drops 50 more (198000 + 300 - 350)');
SELECT is(pg_temp.legs('d7000000-0000-0000-0000-000000000002'), 1, 'it still has its one leg');

-- ---------------------------------------------------------------------------
-- Deleting reverses every leg
-- ---------------------------------------------------------------------------
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000001'), 'deleting the mortgage bill succeeds');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000001'), 4930.00, 'chequing gets its 1600 back (3330 + 1600)');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 199550.00, 'the mortgage gets its 1600 back (197950 + 1600)');
SELECT is(pg_temp.legs('d7000000-0000-0000-0000-000000000001'), 0, 'both of its legs are gone');

SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000002'), 'deleting the no-account bill succeeds');
SELECT is(pg_temp.balance('a7000000-0000-0000-0000-000000000002'), 199900.00, 'the mortgage gets its 350 back (199550 + 350)');
SELECT is(pg_temp.legs('d7000000-0000-0000-0000-000000000002'), 0, 'its leg is gone');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
