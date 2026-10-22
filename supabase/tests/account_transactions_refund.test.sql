-- ============================================================================
-- pgTAP tests for refund rows in account_transactions (migration 014).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- Rows are written the way createUnifiedTransaction writes them: an income-side refund
-- is +amount on an asset (money back in) and -amount on a liability (debt reduced),
-- with the matching current_balance change and a linked budget transaction.
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

-- Mirrors createUnifiedTransaction for an income refund: budget row, ledger row, balance, link.
CREATE OR REPLACE FUNCTION pg_temp.record_refund(p_tx UUID, p_account UUID, p_ledger_amount DECIMAL, p_date DATE) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_ledger UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.transactions (id, user_id, name, amount, transaction_date)
    VALUES (p_tx, auth.uid(), 'Refund', ABS(p_ledger_amount), p_date);
    INSERT INTO public.account_transactions (id, account_id, user_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
    VALUES (v_ledger, p_account, auth.uid(), p_ledger_amount, 'refund', 'Refund', p_date, p_tx);
    UPDATE public.accounts SET current_balance = current_balance + p_ledger_amount WHERE id = p_account;
    UPDATE public.transactions SET linked_account_transaction_id = v_ledger WHERE id = p_tx;
END;
$$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('44444444-0000-0000-0000-000000000004', 'refund@refund-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
SELECT set_config('request.jwt.claims', json_build_object('sub', '44444444-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);

SELECT pg_temp.make_account('c4000000-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004', 'chequing', 1000);
SELECT pg_temp.make_account('c4000000-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000004', 'credit_card', 500);

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- The ledger accepts refunds
-- ---------------------------------------------------------------------------
SELECT lives_ok(
    $$SELECT pg_temp.record_refund('d4000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 25, '2026-10-05')$$,
    'an asset refund can be recorded'
);
SELECT lives_ok(
    $$SELECT pg_temp.record_refund('d4000000-0000-0000-0000-000000000002', 'c4000000-0000-0000-0000-000000000002', -40, '2026-10-05')$$,
    'a liability refund can be recorded'
);
SELECT throws_ok(
    $$INSERT INTO public.account_transactions (account_id, user_id, amount, transaction_type, description)
      VALUES ('c4000000-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004', 1, 'bogus', 'x')$$,
    '23514',
    NULL,
    'unknown transaction types are still rejected'
);

-- ---------------------------------------------------------------------------
-- Balances: refunds add to assets and reduce debt; deleting reverses them
-- ---------------------------------------------------------------------------
SELECT is((SELECT current_balance FROM public.accounts WHERE id = 'c4000000-0000-0000-0000-000000000001'), 1025.00, 'asset refund adds to the balance');
SELECT is((SELECT current_balance FROM public.accounts WHERE id = 'c4000000-0000-0000-0000-000000000002'), 460.00, 'liability refund reduces the debt');

SELECT ok(
    public.update_unified_transaction('d4000000-0000-0000-0000-000000000001',
        '{"description": "Refund", "amount": 30, "date": "2026-10-05", "type": "income", "transactionType": "refund", "accountId": "c4000000-0000-0000-0000-000000000001"}'::jsonb),
    'editing an asset refund succeeds'
);
SELECT is((SELECT current_balance FROM public.accounts WHERE id = 'c4000000-0000-0000-0000-000000000001'), 1030.00, 'edited asset refund moves the balance by the difference');
SELECT is(
    (SELECT transaction_type FROM public.account_transactions WHERE linked_allocation_transaction_id = 'd4000000-0000-0000-0000-000000000001'),
    'refund',
    'editing keeps the refund type'
);

SELECT ok(public.delete_unified_transaction('d4000000-0000-0000-0000-000000000001'), 'deleting an asset refund succeeds');
SELECT is((SELECT current_balance FROM public.accounts WHERE id = 'c4000000-0000-0000-0000-000000000001'), 1000.00, 'deleting the asset refund restores the balance');
SELECT ok(public.delete_unified_transaction('d4000000-0000-0000-0000-000000000002'), 'deleting a liability refund succeeds');
SELECT is((SELECT current_balance FROM public.accounts WHERE id = 'c4000000-0000-0000-0000-000000000002'), 500.00, 'deleting the liability refund restores the debt');

-- That a refund into a TFSA uses no contribution room is covered with the contribution-room
-- tests (migration 013, issue #121), which this branch does not depend on.

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
