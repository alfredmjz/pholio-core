-- ============================================================================
-- pgTAP tests for editing income on liability accounts (migration 015).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- Rows are written the way createUnifiedTransaction writes them (calculateSignedDelta):
-- liability payments and refunds are -amount (debt goes down), asset deposits and refunds
-- are +amount. Edits are sent the way the Allocations dialog sends them, without
-- transactionType, unless a test says otherwise.
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

-- Mirrors createUnifiedTransaction: budget row, ledger row, balance, link.
CREATE OR REPLACE FUNCTION pg_temp.record(p_tx UUID, p_account UUID, p_type TEXT, p_budget_amount DECIMAL, p_ledger_amount DECIMAL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_ledger UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.transactions (id, user_id, name, amount, transaction_date)
    VALUES (p_tx, auth.uid(), p_type, p_budget_amount, '2026-10-05');
    INSERT INTO public.account_transactions (id, account_id, user_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
    VALUES (v_ledger, p_account, auth.uid(), p_ledger_amount, p_type, p_type, '2026-10-05', p_tx);
    UPDATE public.accounts SET current_balance = current_balance + p_ledger_amount WHERE id = p_account;
    UPDATE public.transactions SET linked_account_transaction_id = v_ledger WHERE id = p_tx;
END;
$$;

-- Calls update_unified_transaction the way TransactionDialog does.
CREATE OR REPLACE FUNCTION pg_temp.edit(p_tx UUID, p_account UUID, p_intent TEXT, p_amount DECIMAL, p_tx_type TEXT DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE sql AS $$
    SELECT public.update_unified_transaction(p_tx, jsonb_strip_nulls(jsonb_build_object(
        'description', 'Edited', 'amount', p_amount, 'date', '2026-10-05', 'type', p_intent,
        'accountId', p_account, 'transactionType', p_tx_type
    )));
$$;

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

CREATE OR REPLACE FUNCTION pg_temp.ledger(p_tx UUID) RETURNS TABLE (account_id UUID, amount DECIMAL, transaction_type TEXT)
LANGUAGE sql AS $$
    SELECT a.account_id, a.amount, a.transaction_type
    FROM public.account_transactions a
    JOIN public.transactions t ON t.linked_account_transaction_id = a.id
    WHERE t.id = p_tx;
$$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('55555555-0000-0000-0000-000000000005', 'edit@edit-signs-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
SELECT set_config('request.jwt.claims', json_build_object('sub', '55555555-0000-0000-0000-000000000005', 'role', 'authenticated')::text, true);

-- c5..01 chequing 1000, c5..02 credit card 500 debt, c5..03 line of credit 300 debt
SELECT pg_temp.make_account('c5000000-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000005', 'chequing', 1000);
SELECT pg_temp.make_account('c5000000-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000005', 'credit_card', 500);
SELECT pg_temp.make_account('c5000000-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000005', 'line_of_credit', 300);

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Same account: liability payment
-- ---------------------------------------------------------------------------
SELECT pg_temp.record('d5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000002', 'payment', 40, -40);
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 460.00, 'card payment reduces the debt');

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000002', 'income', 40), 're-saving a card payment succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 460.00, 're-saving an unchanged card payment leaves the debt alone');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), -40.00, 're-saved card payment stays negative');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), 'payment', 're-saved card payment stays a payment');

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000002', 'income', 50), 'raising a card payment succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 450.00, 'a larger card payment reduces the debt by the difference');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), -50.00, 'edited card payment is stored as -50');

-- ---------------------------------------------------------------------------
-- Same account: liability refund
-- ---------------------------------------------------------------------------
SELECT pg_temp.record('d5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000002', 'refund', 40, -40);
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 410.00, 'card refund reduces the debt');

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000002', 'income', 40), 're-saving a card refund succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 410.00, 're-saving an unchanged card refund leaves the debt alone');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), -40.00, 're-saved card refund stays negative');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), 'refund', 're-saved card refund stays a refund');

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000002', 'income', 30, 'refund'), 'editing a card refund with an explicit type succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 420.00, 'a smaller card refund gives back the difference');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), -30.00, 'edited card refund is stored as -30');
SELECT is((SELECT amount FROM public.transactions WHERE id = 'd5000000-0000-0000-0000-000000000002'), 30.00, 'the budget row of a refund stays positive income');

-- ---------------------------------------------------------------------------
-- Account change: liability to liability
-- ---------------------------------------------------------------------------
SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000003', 'income', 30), 'moving a refund to another liability succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 450.00, 'moving the refund off the card restores its debt');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000003'), 270.00, 'the moved refund reduces the line of credit debt');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), -30.00, 'moved liability refund is negative');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), 'refund', 'moved refund stays a refund');
SELECT is(
    (SELECT count(*)::INT FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd5000000-0000-0000-0000-000000000002'),
    1,
    'moving a refund leaves a single ledger row'
);

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000003', 'income', 50), 'moving a payment to another liability succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 500.00, 'moving the payment off the card restores its debt');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000003'), 220.00, 'the moved payment reduces the line of credit debt');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), -50.00, 'moved liability payment is negative');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), 'payment', 'moved payment stays a payment');

-- ---------------------------------------------------------------------------
-- Account change: liability to asset and back
-- ---------------------------------------------------------------------------
SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000002', 'c5000000-0000-0000-0000-000000000001', 'income', 30), 'moving a refund to chequing succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000003'), 250.00, 'moving the refund off the line of credit restores its debt');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000001'), 1030.00, 'the moved refund adds to chequing');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), 30.00, 'asset refund is positive');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000002')), 'refund', 'refund moved to an asset stays a refund');

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'income', 50), 'moving a payment to chequing succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000003'), 300.00, 'moving the payment off the line of credit restores its debt');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000001'), 1080.00, 'the moved payment adds to chequing');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), 'deposit', 'a payment moved to an asset becomes a deposit');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000001')), 50.00, 'the resulting deposit is positive');

SELECT pg_temp.record('d5000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000001', 'deposit', 100, 100);
SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000002', 'income', 100), 'moving a deposit to the card succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000001'), 1080.00, 'moving the deposit off chequing removes it');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 400.00, 'the moved deposit pays down the card');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000003')), 'payment', 'a deposit moved to a liability becomes a payment');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000003')), -100.00, 'the resulting payment is negative');

SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000003', 'income', 100, 'refund'), 'moving with an explicit refund type succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 500.00, 'moving the payment off the card restores its debt');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000003'), 200.00, 'the explicit refund reduces the line of credit debt');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000003')), 'refund', 'the explicit transactionType is used on an account change');

-- ---------------------------------------------------------------------------
-- Expenses keep their sign
-- ---------------------------------------------------------------------------
SELECT pg_temp.record('d5000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000002', 'adjustment', -25, 25);
SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000002', 'expense', 25), 're-saving a card charge succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000002'), 525.00, 're-saving an unchanged card charge leaves the debt alone');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000004')), 25.00, 'card charge stays positive');
SELECT is((SELECT transaction_type FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000004')), 'adjustment', 'card charge keeps its type');

SELECT pg_temp.record('d5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000001', 'withdrawal', -60, -60);
SELECT ok(pg_temp.edit('d5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000001', 'expense', 60), 're-saving a chequing withdrawal succeeds');
SELECT is(pg_temp.balance('c5000000-0000-0000-0000-000000000001'), 1020.00, 're-saving an unchanged withdrawal leaves chequing alone');
SELECT is((SELECT amount FROM pg_temp.ledger('d5000000-0000-0000-0000-000000000005')), -60.00, 'withdrawal stays negative');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
