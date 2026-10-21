-- ============================================================================
-- pgTAP tests for editing transfers (migration 016).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- Transfers are written the way createUnifiedTransaction writes them: a +amount budget row
-- with source 'transfer', a from-leg (asset -amount, liability +amount) linked from the budget
-- row, and a to-leg with the opposite sign, the two legs linked to each other.
-- Edits are sent the way the Allocations dialog sends them.
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

-- Calls update_unified_transaction the way TransactionDialog does (accountId = fromAccountId for transfers).
CREATE OR REPLACE FUNCTION pg_temp.edit(p_tx UUID, p_intent TEXT, p_amount DECIMAL, p_from UUID, p_to UUID DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE sql AS $$
    SELECT public.update_unified_transaction(p_tx, jsonb_strip_nulls(jsonb_build_object(
        'description', 'Edited', 'amount', p_amount, 'date', '2026-10-05', 'type', p_intent,
        'accountId', p_from,
        'fromAccountId', CASE WHEN p_intent = 'transfer' THEN p_from END,
        'toAccountId', CASE WHEN p_intent = 'transfer' THEN p_to END
    )));
$$;

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

-- The leg the budget row links to.
CREATE OR REPLACE FUNCTION pg_temp.from_leg(p_tx UUID) RETURNS public.account_transactions
LANGUAGE sql AS $$
    SELECT a.* FROM public.account_transactions a JOIN public.transactions t ON t.linked_account_transaction_id = a.id WHERE t.id = p_tx;
$$;

-- The other leg linked to the budget row.
CREATE OR REPLACE FUNCTION pg_temp.to_leg(p_tx UUID) RETURNS public.account_transactions
LANGUAGE sql AS $$
    SELECT a.* FROM public.account_transactions a JOIN public.transactions t ON t.id = a.linked_allocation_transaction_id
    WHERE t.id = p_tx AND a.id IS DISTINCT FROM t.linked_account_transaction_id;
$$;

CREATE OR REPLACE FUNCTION pg_temp.leg_count(p_tx UUID) RETURNS INT
LANGUAGE sql AS $$ SELECT count(*)::INT FROM public.account_transactions WHERE linked_allocation_transaction_id = p_tx; $$;

CREATE OR REPLACE FUNCTION pg_temp.legs_linked(p_tx UUID) RETURNS BOOLEAN
LANGUAGE sql AS $$
    SELECT (pg_temp.from_leg(p_tx)).linked_transfer_transaction_id = (pg_temp.to_leg(p_tx)).id
       AND (pg_temp.to_leg(p_tx)).linked_transfer_transaction_id = (pg_temp.from_leg(p_tx)).id;
$$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('66666666-0000-0000-0000-000000000006', 'edit@edit-transfers-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
SELECT set_config('request.jwt.claims', json_build_object('sub', '66666666-0000-0000-0000-000000000006', 'role', 'authenticated')::text, true);

-- c6..01 chequing 1000, c6..02 savings 500, c6..03 credit card 400 debt
SELECT pg_temp.make_account('c6000000-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000006', 'chequing', 1000);
SELECT pg_temp.make_account('c6000000-0000-0000-0000-000000000002', '66666666-0000-0000-0000-000000000006', 'savings', 500);
SELECT pg_temp.make_account('c6000000-0000-0000-0000-000000000003', '66666666-0000-0000-0000-000000000006', 'credit_card', 400);

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- Same accounts: amount edits move both balances
-- ---------------------------------------------------------------------------
SELECT pg_temp.record_transfer('d6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000002', 100);

SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 100, 'c6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000002'), 're-saving a transfer succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000001'), 900.00, 're-saving an unchanged transfer leaves the source alone');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 600.00, 're-saving an unchanged transfer leaves the destination alone');
SELECT is((SELECT amount FROM public.transactions WHERE id = 'd6000000-0000-0000-0000-000000000001'), 100.00, 'the transfer budget row stays positive');
SELECT is((SELECT source FROM public.transactions WHERE id = 'd6000000-0000-0000-0000-000000000001'), 'transfer', 'the budget row stays a transfer');
SELECT is(pg_temp.leg_count('d6000000-0000-0000-0000-000000000001'), 2, 'the transfer still has two legs');

SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 150, 'c6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000002'), 'raising a transfer succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000001'), 850.00, 'a larger transfer takes the difference from the source');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 650.00, 'a larger transfer adds the difference to the destination');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000001')).amount, -150.00, 'asset from-leg is -150');
SELECT is((pg_temp.to_leg('d6000000-0000-0000-0000-000000000001')).amount, 150.00, 'asset to-leg is +150');
SELECT is((pg_temp.to_leg('d6000000-0000-0000-0000-000000000001')).description, 'Edited', 'the to-leg gets the new description');

SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 150, 'c6000000-0000-0000-0000-000000000001', NULL), 'a transfer edit without toAccountId succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 650.00, 'without toAccountId the destination is kept');
SELECT is((pg_temp.to_leg('d6000000-0000-0000-0000-000000000001')).account_id, 'c6000000-0000-0000-0000-000000000002'::UUID, 'without toAccountId the to-leg stays on savings');

-- ---------------------------------------------------------------------------
-- Account changes
-- ---------------------------------------------------------------------------
SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 150, 'c6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000003'), 'changing the destination succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 500.00, 'the old destination gets its money back out');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000003'), 250.00, 'the new card destination has its debt paid down');
SELECT is((pg_temp.to_leg('d6000000-0000-0000-0000-000000000001')).amount, -150.00, 'liability to-leg is -150');
SELECT is((pg_temp.to_leg('d6000000-0000-0000-0000-000000000001')).transaction_type, 'transfer', 'the new to-leg is a transfer');
SELECT is(pg_temp.leg_count('d6000000-0000-0000-0000-000000000001'), 2, 'changing the destination leaves two legs');
SELECT ok(pg_temp.legs_linked('d6000000-0000-0000-0000-000000000001'), 'the legs are linked to each other after a destination change');

SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 150, 'c6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000003'), 'changing the source succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000001'), 1000.00, 'the old source gets its money back');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 350.00, 'the new source pays the transfer');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000003'), 250.00, 'the destination is unchanged by a source change');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000001')).account_id, 'c6000000-0000-0000-0000-000000000002'::UUID, 'the budget row links to the new source leg');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000001')).transaction_type, 'transfer', 'the new source leg is a transfer');
SELECT is(pg_temp.leg_count('d6000000-0000-0000-0000-000000000001'), 2, 'changing the source leaves two legs');
SELECT ok(pg_temp.legs_linked('d6000000-0000-0000-0000-000000000001'), 'the legs are linked to each other after a source change');

SELECT is(
    pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 150, 'c6000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-000000000003'),
    false,
    'a transfer to the same account is rejected'
);
SELECT is(
    pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 150, NULL, 'c6000000-0000-0000-0000-000000000003'),
    false,
    'a transfer without a source is rejected'
);
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 350.00, 'a rejected edit leaves the source alone');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000003'), 250.00, 'a rejected edit leaves the destination alone');

-- ---------------------------------------------------------------------------
-- Changing the type to and from transfer
-- ---------------------------------------------------------------------------
SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'expense', 150, 'c6000000-0000-0000-0000-000000000002'), 'turning a transfer into an expense succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000003'), 400.00, 'the old destination leg is reversed');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 350.00, 'the source keeps the outflow as an expense');
SELECT is(pg_temp.leg_count('d6000000-0000-0000-0000-000000000001'), 1, 'an expense has one leg');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000001')).transaction_type, 'withdrawal', 'the remaining leg becomes a withdrawal');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000001')).linked_transfer_transaction_id, NULL::UUID, 'the remaining leg is no longer linked to a partner');
SELECT is((SELECT amount FROM public.transactions WHERE id = 'd6000000-0000-0000-0000-000000000001'), -150.00, 'the expense budget row is negative');
SELECT is((SELECT source FROM public.transactions WHERE id = 'd6000000-0000-0000-0000-000000000001'), 'manual', 'the budget row is no longer a transfer');

SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000001', 'transfer', 50, 'c6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000001'), 'turning an expense into a transfer succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000002'), 450.00, 'the source pays only the new transfer amount');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000001'), 1050.00, 'the destination receives the transfer');
SELECT is(pg_temp.leg_count('d6000000-0000-0000-0000-000000000001'), 2, 'the new transfer has two legs');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000001')).transaction_type, 'transfer', 'the source leg becomes a transfer');
SELECT ok(pg_temp.legs_linked('d6000000-0000-0000-0000-000000000001'), 'the new legs are linked to each other');
SELECT is((SELECT amount FROM public.transactions WHERE id = 'd6000000-0000-0000-0000-000000000001'), 50.00, 'the transfer budget row is positive');
SELECT is((SELECT source FROM public.transactions WHERE id = 'd6000000-0000-0000-0000-000000000001'), 'transfer', 'the budget row becomes a transfer');

-- ---------------------------------------------------------------------------
-- Liability source (cash advance)
-- ---------------------------------------------------------------------------
SELECT pg_temp.record_transfer('d6000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-000000000001', 200);
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000003'), 600.00, 'a cash advance adds to the card debt');

SELECT ok(pg_temp.edit('d6000000-0000-0000-0000-000000000002', 'transfer', 100, 'c6000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-000000000001'), 'lowering a cash advance succeeds');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000003'), 500.00, 'a smaller cash advance lowers the card debt');
SELECT is(pg_temp.balance('c6000000-0000-0000-0000-000000000001'), 1150.00, 'a smaller cash advance lowers chequing');
SELECT is((pg_temp.from_leg('d6000000-0000-0000-0000-000000000002')).amount, 100.00, 'liability from-leg is +100');
SELECT is((pg_temp.to_leg('d6000000-0000-0000-0000-000000000002')).amount, 100.00, 'asset to-leg is +100');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
