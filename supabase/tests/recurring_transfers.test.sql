-- ============================================================================
-- pgTAP tests for posting recurring transfers to both accounts (migration 016).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- An occurrence is inserted the way payRecurringExpense and the auto-post sync insert it:
-- one +amount budget row with source 'transfer', no category and a recurring_expense_id.
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

CREATE OR REPLACE FUNCTION pg_temp.make_transfer(p_id UUID, p_name TEXT, p_amount DECIMAL, p_from UUID, p_to UUID) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.recurring_expenses (id, user_id, name, amount, billing_period, next_due_date, category, account_id, to_account_id)
    VALUES (p_id, '99999999-0000-0000-0000-000000000001', p_name, p_amount, '1:months', '2026-11-01', 'transfer', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION pg_temp.run(p_tx UUID, p_transfer UUID, p_date DATE) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, covers_due_date, source, recurring_expense_id)
    SELECT p_tx, auth.uid(), r.name, ABS(r.amount), p_date, p_date, 'transfer', r.id FROM public.recurring_expenses r WHERE r.id = p_transfer;
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
VALUES
    ('99999999-0000-0000-0000-000000000001', 'owner@recurring-transfers-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    ('99999999-0000-0000-0000-000000000002', 'other@recurring-transfers-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- c9..01 chequing 1000, c9..02 TFSA (investment) 2000, c9..03 credit card 400 debt,
-- c9..04 savings 300 (inactive), c9..05 the other user's chequing 1000
SELECT pg_temp.make_account('c9000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'chequing', 1000);
SELECT pg_temp.make_account('c9000000-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000001', 'investment', 2000);
SELECT pg_temp.make_account('c9000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'credit_card', 400);
SELECT pg_temp.make_account('c9000000-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000001', 'savings', 300);
UPDATE public.accounts SET is_active = false WHERE id = 'c9000000-0000-0000-0000-000000000004';
SELECT pg_temp.make_account('c9000000-0000-0000-0000-000000000005', '99999999-0000-0000-0000-000000000002', 'chequing', 1000);

-- e9..01 chequing -> TFSA 500, e9..02 chequing -> card 150, e9..03 card -> chequing 100,
-- e9..04 chequing -> inactive savings 50, e9..05 chequing -> other user's chequing 25,
-- e9..06 chequing -> (deleted account) 75
SELECT pg_temp.make_transfer('e9000000-0000-0000-0000-000000000001', 'TFSA contribution', 500, 'c9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000002');
SELECT pg_temp.make_transfer('e9000000-0000-0000-0000-000000000002', 'Card payment', 150, 'c9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000003');
SELECT pg_temp.make_transfer('e9000000-0000-0000-0000-000000000003', 'Cash from card', 100, 'c9000000-0000-0000-0000-000000000003', 'c9000000-0000-0000-0000-000000000001');
SELECT pg_temp.make_transfer('e9000000-0000-0000-0000-000000000004', 'To old savings', 50, 'c9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000004');
SELECT pg_temp.make_transfer('e9000000-0000-0000-0000-000000000005', 'Sneaky', 25, 'c9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000005');
SELECT pg_temp.make_transfer('e9000000-0000-0000-0000-000000000006', 'Orphan', 75, 'c9000000-0000-0000-0000-000000000001', NULL);

SELECT set_config('request.jwt.claims', json_build_object('sub', '99999999-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Asset to asset: both legs, linked to each other and to the budget row
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001', '2026-11-01');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), 500.00, 'the TFSA transfer takes 500 from chequing (1000 - 500)');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000002'), 2500.00, 'and adds 500 to the TFSA (2000 + 500)');
SELECT is(pg_temp.leg('d9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001'), '-500.00 transfer', 'the chequing leg is a -500 transfer');
SELECT is(pg_temp.leg('d9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000002'), '500.00 transfer', 'the TFSA leg is a +500 transfer');
SELECT is(
    (SELECT description || ' ' || transaction_date FROM public.account_transactions
     WHERE linked_allocation_transaction_id = 'd9000000-0000-0000-0000-000000000001' AND account_id = 'c9000000-0000-0000-0000-000000000002'),
    'TFSA contribution 2026-11-01', 'the legs take the transfer name and date'
);
SELECT is(
    (SELECT t.linked_account_transaction_id FROM public.transactions t WHERE t.id = 'd9000000-0000-0000-0000-000000000001'),
    (SELECT id FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd9000000-0000-0000-0000-000000000001' AND account_id = 'c9000000-0000-0000-0000-000000000001'),
    'the budget row links to the from-leg'
);
SELECT is(
    (SELECT f.linked_transfer_transaction_id = t.id AND t.linked_transfer_transaction_id = f.id
     FROM public.account_transactions f
     JOIN public.account_transactions t ON t.linked_allocation_transaction_id = f.linked_allocation_transaction_id AND t.id <> f.id
     WHERE f.linked_allocation_transaction_id = 'd9000000-0000-0000-0000-000000000001' AND f.account_id = 'c9000000-0000-0000-0000-000000000001'),
    true, 'the two legs link to each other'
);
SELECT is(
    (SELECT amount FROM public.recurring_recorded_occurrences
     WHERE recurring_expense_id = 'e9000000-0000-0000-0000-000000000001' AND occurrence_date = '2026-11-01'),
    500.00, 'the occurrence is recorded so auto-posting never repeats it'
);
SELECT is(
    (SELECT category_id FROM public.transactions WHERE id = 'd9000000-0000-0000-0000-000000000001'),
    NULL, 'the budget row has no category'
);

-- ---------------------------------------------------------------------------
-- Into a liability: pays down the debt; out of a liability: adds to it
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d9000000-0000-0000-0000-000000000002', 'e9000000-0000-0000-0000-000000000002', '2026-11-01');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), 350.00, 'the card payment takes 150 from chequing (500 - 150)');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000003'), 250.00, 'and lowers the card debt by 150 (400 - 150)');
SELECT is(pg_temp.leg('d9000000-0000-0000-0000-000000000002', 'c9000000-0000-0000-0000-000000000003'), '-150.00 transfer', 'the card leg is a -150 transfer');

SELECT pg_temp.run('d9000000-0000-0000-0000-000000000003', 'e9000000-0000-0000-0000-000000000003', '2026-11-02');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000003'), 350.00, 'moving 100 off the card adds to its debt (250 + 100)');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), 450.00, 'and adds 100 to chequing (350 + 100)');
SELECT is(pg_temp.leg('d9000000-0000-0000-0000-000000000003', 'c9000000-0000-0000-0000-000000000003'), '100.00 transfer', 'the card leg is a +100 transfer');

-- ---------------------------------------------------------------------------
-- Caps do not apply: the next TFSA transfer takes chequing below zero
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d9000000-0000-0000-0000-000000000004', 'e9000000-0000-0000-0000-000000000001', '2026-12-01');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), -50.00, 'a transfer past the balance still posts (450 - 500)');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000002'), 3000.00, 'the TFSA gets the 500 (2500 + 500)');

-- ---------------------------------------------------------------------------
-- Nothing posts without two usable accounts
-- ---------------------------------------------------------------------------
SELECT pg_temp.run('d9000000-0000-0000-0000-000000000005', 'e9000000-0000-0000-0000-000000000004', '2026-11-01');
SELECT is(pg_temp.legs('d9000000-0000-0000-0000-000000000005'), 0, 'a transfer to an inactive account posts no legs');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000004'), 300.00, 'the inactive account keeps its balance');

SELECT pg_temp.run('d9000000-0000-0000-0000-000000000006', 'e9000000-0000-0000-0000-000000000005', '2026-11-01');
SELECT is(pg_temp.legs('d9000000-0000-0000-0000-000000000006'), 0, 'a transfer to another user''s account posts nothing');

SELECT pg_temp.run('d9000000-0000-0000-0000-000000000007', 'e9000000-0000-0000-0000-000000000006', '2026-11-01');
SELECT is(pg_temp.legs('d9000000-0000-0000-0000-000000000007'), 0, 'a transfer missing its destination posts nothing');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), -50.00, 'chequing is untouched by the three skipped transfers');

RESET ROLE;
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000005'), 1000.00, 'the other user''s balance is untouched');
SET LOCAL ROLE authenticated;

-- A manual transfer (no recurring_expense_id) is left to createUnifiedTransaction.
INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source)
VALUES ('d9000000-0000-0000-0000-000000000008', auth.uid(), 'Manual move', 40, '2026-11-03', 'transfer');
SELECT is(pg_temp.legs('d9000000-0000-0000-0000-000000000008'), 0, 'a manual transfer row is not posted by the trigger');

-- ---------------------------------------------------------------------------
-- The posted transfer edits and deletes like any transfer
-- ---------------------------------------------------------------------------
SELECT ok(
    public.update_unified_transaction('d9000000-0000-0000-0000-000000000004',
        '{"description": "TFSA contribution", "amount": 200, "date": "2026-12-01", "type": "transfer",
          "accountId": "c9000000-0000-0000-0000-000000000001", "fromAccountId": "c9000000-0000-0000-0000-000000000001",
          "toAccountId": "c9000000-0000-0000-0000-000000000002"}'::jsonb),
    'editing the December transfer succeeds'
);
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), 250.00, 'lowering it to 200 gives chequing 300 back (-50 + 500 - 200)');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000002'), 2700.00, 'and takes 300 off the TFSA (3000 - 500 + 200)');

SELECT ok(public.delete_unified_transaction('d9000000-0000-0000-0000-000000000001'), 'deleting the November TFSA transfer succeeds');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000001'), 750.00, 'deleting it gives chequing its 500 back (250 + 500)');
SELECT is(pg_temp.balance('c9000000-0000-0000-0000-000000000002'), 2200.00, 'and takes 500 off the TFSA (2700 - 500)');
SELECT is(pg_temp.legs('d9000000-0000-0000-0000-000000000001'), 0, 'both of its legs are gone');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
