-- ============================================================================
-- pgTAP tests for deleting transfers (migration 017).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- Transfers are written the way createUnifiedTransaction writes them: a +amount budget row
-- with source 'transfer', a from-leg (asset -amount, liability +amount) linked from the budget
-- row, and a to-leg with the opposite sign, the two legs linked to each other.
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

CREATE OR REPLACE FUNCTION pg_temp.is_asset(p_account UUID) RETURNS BOOLEAN
LANGUAGE sql AS $$
    SELECT t.class = 'asset' FROM public.accounts a JOIN public.account_types t ON t.id = a.account_type_id WHERE a.id = p_account;
$$;

-- Mirrors createUnifiedTransaction for a transfer.
CREATE OR REPLACE FUNCTION pg_temp.record_transfer(p_tx UUID, p_from UUID, p_to UUID, p_amount DECIMAL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_from_leg UUID := gen_random_uuid();
    v_to_leg UUID := gen_random_uuid();
    v_from_amount DECIMAL := CASE WHEN pg_temp.is_asset(p_from) THEN -p_amount ELSE p_amount END;
    v_to_amount DECIMAL := CASE WHEN pg_temp.is_asset(p_to) THEN p_amount ELSE -p_amount END;
BEGIN
    INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source)
    VALUES (p_tx, auth.uid(), 'Transfer', p_amount, '2026-10-05', 'transfer');
    INSERT INTO public.account_transactions (id, account_id, user_id, amount, transaction_type, description, transaction_date, linked_allocation_transaction_id)
    VALUES (v_from_leg, p_from, auth.uid(), v_from_amount, 'transfer', 'Transfer', '2026-10-05', p_tx),
           (v_to_leg, p_to, auth.uid(), v_to_amount, 'transfer', 'Transfer', '2026-10-05', p_tx);
    UPDATE public.account_transactions SET linked_transfer_transaction_id = v_to_leg WHERE id = v_from_leg;
    UPDATE public.account_transactions SET linked_transfer_transaction_id = v_from_leg WHERE id = v_to_leg;
    UPDATE public.accounts SET current_balance = current_balance + v_from_amount WHERE id = p_from;
    UPDATE public.accounts SET current_balance = current_balance + v_to_amount WHERE id = p_to;
    UPDATE public.transactions SET linked_account_transaction_id = v_from_leg WHERE id = p_tx;
END;
$$;

-- Mirrors createUnifiedTransaction for an income or expense on one account.
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

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

CREATE OR REPLACE FUNCTION pg_temp.ledger_rows(p_account UUID) RETURNS INT
LANGUAGE sql AS $$ SELECT count(*)::INT FROM public.account_transactions WHERE account_id = p_account; $$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
    ('77777777-0000-0000-0000-000000000007', 'delete@delete-transfers-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    ('77777777-0000-0000-0000-000000000008', 'other@delete-transfers-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
SELECT set_config('request.jwt.claims', json_build_object('sub', '77777777-0000-0000-0000-000000000007', 'role', 'authenticated')::text, true);

-- c7..01 chequing 1000, c7..02 savings 500, c7..03 credit card 400 debt
SELECT pg_temp.make_account('c7000000-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000007', 'chequing', 1000);
SELECT pg_temp.make_account('c7000000-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000007', 'savings', 500);
SELECT pg_temp.make_account('c7000000-0000-0000-0000-000000000003', '77777777-0000-0000-0000-000000000007', 'credit_card', 400);

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Asset to asset
-- ---------------------------------------------------------------------------
SELECT pg_temp.record_transfer('d7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 100);
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000001'), 'deleting a transfer succeeds');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000001'), 1000.00, 'deleting a transfer restores the source');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000002'), 500.00, 'deleting a transfer restores the destination');
SELECT is(pg_temp.ledger_rows('c7000000-0000-0000-0000-000000000001'), 0, 'the source leg is gone');
SELECT is(pg_temp.ledger_rows('c7000000-0000-0000-0000-000000000002'), 0, 'the destination leg is gone');
SELECT is((SELECT count(*)::INT FROM public.transactions WHERE id = 'd7000000-0000-0000-0000-000000000001'), 0, 'the budget row is gone');

-- ---------------------------------------------------------------------------
-- Asset to liability (card payment by transfer) and liability to asset (cash advance)
-- ---------------------------------------------------------------------------
SELECT pg_temp.record_transfer('d7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000003', 80);
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000003'), 320.00, 'a transfer to the card pays down the debt');
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000002'), 'deleting a transfer to a card succeeds');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000001'), 1000.00, 'deleting a card payment transfer restores chequing');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000003'), 400.00, 'deleting a card payment transfer restores the debt');

SELECT pg_temp.record_transfer('d7000000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-000000000003', 'c7000000-0000-0000-0000-000000000001', 200);
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000003'), 'deleting a cash advance succeeds');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000003'), 400.00, 'deleting a cash advance restores the debt');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000001'), 1000.00, 'deleting a cash advance restores chequing');
SELECT is(pg_temp.ledger_rows('c7000000-0000-0000-0000-000000000003'), 0, 'no card legs are left');

-- ---------------------------------------------------------------------------
-- A transfer whose destination was changed by an edit
-- ---------------------------------------------------------------------------
SELECT pg_temp.record_transfer('d7000000-0000-0000-0000-000000000004', 'c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 60);
SELECT ok(
    public.update_unified_transaction('d7000000-0000-0000-0000-000000000004',
        '{"description": "Transfer", "amount": 60, "date": "2026-10-05", "type": "transfer", "accountId": "c7000000-0000-0000-0000-000000000001", "fromAccountId": "c7000000-0000-0000-0000-000000000001", "toAccountId": "c7000000-0000-0000-0000-000000000003"}'::jsonb),
    'moving the transfer to the card succeeds'
);
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000004'), 'deleting the edited transfer succeeds');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000001'), 1000.00, 'deleting the edited transfer restores chequing');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000002'), 500.00, 'savings is untouched after the edit and delete');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000003'), 400.00, 'deleting the edited transfer restores the card');

-- ---------------------------------------------------------------------------
-- Non-transfers still remove only their own leg
-- ---------------------------------------------------------------------------
SELECT pg_temp.record('d7000000-0000-0000-0000-000000000005', 'c7000000-0000-0000-0000-000000000001', 'withdrawal', -30, -30);
SELECT pg_temp.record('d7000000-0000-0000-0000-000000000006', 'c7000000-0000-0000-0000-000000000003', 'payment', 50, -50);
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000005'), 'deleting an expense succeeds');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000001'), 1000.00, 'deleting an expense restores chequing');
SELECT is(pg_temp.ledger_rows('c7000000-0000-0000-0000-000000000003'), 1, 'deleting an expense leaves other legs alone');
SELECT ok(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000006'), 'deleting a card payment succeeds');
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000003'), 400.00, 'deleting a card payment restores the debt');

-- ---------------------------------------------------------------------------
-- Another user cannot delete the transfer
-- ---------------------------------------------------------------------------
SELECT pg_temp.record_transfer('d7000000-0000-0000-0000-000000000007', 'c7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000002', 25);
SELECT set_config('request.jwt.claims', json_build_object('sub', '77777777-0000-0000-0000-000000000008', 'role', 'authenticated')::text, true);
SELECT is(public.delete_unified_transaction('d7000000-0000-0000-0000-000000000007'), false, 'another user cannot delete the transfer');
SELECT set_config('request.jwt.claims', json_build_object('sub', '77777777-0000-0000-0000-000000000007', 'role', 'authenticated')::text, true);
SELECT is(pg_temp.balance('c7000000-0000-0000-0000-000000000002'), 525.00, 'the refused delete leaves the destination alone');
SELECT is(pg_temp.ledger_rows('c7000000-0000-0000-0000-000000000002'), 1, 'the refused delete leaves the destination leg');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
