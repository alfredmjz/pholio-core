-- ============================================================================
-- pgTAP tests for post_ledger_entries() (migration 017).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.make_account(p_id UUID, p_owner UUID, p_code TEXT, p_balance DECIMAL) RETURNS VOID
LANGUAGE sql AS $$
    INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance)
    SELECT p_id, p_owner, p_code, t.id, p_balance
    FROM public.account_types t
    WHERE t.code = p_code AND t.user_id IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.balance(p_account UUID) RETURNS DECIMAL
LANGUAGE sql AS $$ SELECT current_balance FROM public.accounts WHERE id = p_account; $$;

CREATE OR REPLACE FUNCTION pg_temp.leg(p_result JSONB, p_index INT) RETURNS UUID
LANGUAGE sql AS $$ SELECT (p_result->'leg_ids'->>p_index)::UUID; $$;

CREATE TEMP TABLE results (name TEXT PRIMARY KEY, result JSONB);
GRANT ALL ON results TO authenticated, service_role;

INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
    ('17000000-0000-0000-0000-000000000001', 'owner@post-ledger-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    ('17000000-0000-0000-0000-000000000002', 'other@post-ledger-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- a1 chequing 100, protection to -200, overdraft fee 5
SELECT pg_temp.make_account('c1700000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'chequing', 100);
UPDATE public.accounts SET overdraft_protection = true, overdraft_limit = 200, overdraft_fee = 5
WHERE id = 'c1700000-0000-0000-0000-000000000001';
-- a2 savings 0
SELECT pg_temp.make_account('c1700000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000001', 'savings', 0);
-- a3 credit card 0 owed, cash advance fee: greater of 10 and 5%
SELECT pg_temp.make_account('c1700000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000001', 'credit_card', 0);
INSERT INTO public.account_charges (account_id, user_id, name, frequency, amount, rate)
VALUES ('c1700000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000001', 'Cash advance fee', 'cash_advance', 10, 0.05);
-- b1 chequing 500, owned by the other user
SELECT pg_temp.make_account('c1700000-0000-0000-0000-000000000009', '17000000-0000-0000-0000-000000000002', 'chequing', 500);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.post_ledger_entries(jsonb, jsonb)', 'EXECUTE'), 'anon cannot call it');
SELECT ok(has_function_privilege('authenticated', 'public.post_ledger_entries(jsonb, jsonb)', 'EXECUTE'), 'authenticated can call it');
SELECT ok(has_function_privilege('service_role', 'public.post_ledger_entries(jsonb, jsonb)', 'EXECUTE'), 'service_role can call it');

SELECT set_config('request.jwt.claims', json_build_object('sub', '17000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- One expense: budget row, ledger leg, balance, links
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'expense', public.post_ledger_entries(
    '{"name": "Groceries", "amount": -30, "transaction_date": "2026-11-10", "notes": null, "source": "manual", "recurring_expense_id": "b1700000-0000-0000-0000-000000000001"}',
    '[{"account_id": "c1700000-0000-0000-0000-000000000001", "amount": -30, "transaction_type": "withdrawal", "description": "Groceries", "transaction_date": "2026-11-10", "user_id": "17000000-0000-0000-0000-000000000002"}]'
);

SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000001'), 70.00, '100 - 30 = 70');
SELECT is(
    (SELECT amount || ' ' || name || ' ' || source || ' ' || user_id FROM public.transactions WHERE id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'expense')),
    '-30.00 Groceries manual 17000000-0000-0000-0000-000000000001', 'the budget row is -30, owned by the caller'
);
SELECT is(
    (SELECT recurring_expense_id FROM public.transactions WHERE id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'expense')),
    NULL, 'recurring_expense_id in the input is ignored'
);
SELECT is(
    (SELECT linked_account_transaction_id FROM public.transactions WHERE id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'expense')),
    (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'expense'), 'the budget row links to its leg'
);
SELECT is(
    (SELECT amount || ' ' || transaction_type || ' ' || transaction_date || ' ' || user_id || ' ' || (linked_allocation_transaction_id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'expense'))
     FROM public.account_transactions WHERE id = (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'expense')),
    '-30.00 withdrawal 2026-11-10 17000000-0000-0000-0000-000000000001 true',
    'the leg is -30, links back to the budget row and takes the account owner, not the user_id sent'
);
SELECT is(
    (SELECT count(*)::INT FROM public.account_transactions WHERE account_id = 'c1700000-0000-0000-0000-000000000001'),
    1, 'exactly one ledger row: no recurring trigger posted a second'
);

-- ---------------------------------------------------------------------------
-- A budget row with no legs
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'budget only', public.post_ledger_entries(
    '{"category_id": null, "name": "Cash lunch", "amount": -12.5, "transaction_date": "2026-11-11", "source": "manual"}', '[]'
);
SELECT is(
    (SELECT result->'leg_ids' FROM results WHERE name = 'budget only'), '[]'::JSONB, 'no legs, no leg ids'
);
SELECT is(
    (SELECT amount || ' ' || COALESCE(linked_account_transaction_id::TEXT, 'unlinked') FROM public.transactions WHERE id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'budget only')),
    '-12.50 unlinked', 'the budget row is stored on its own'
);

-- ---------------------------------------------------------------------------
-- A transfer: one budget row, two legs linked to each other
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'transfer', public.post_ledger_entries(
    '{"name": "Save", "amount": 50, "transaction_date": "2026-11-12", "source": "transfer"}',
    '[{"account_id": "c1700000-0000-0000-0000-000000000001", "amount": -50, "transaction_type": "transfer", "description": "Save", "transaction_date": "2026-11-12", "transfer_pair": 1},
      {"account_id": "c1700000-0000-0000-0000-000000000002", "amount": 50, "transaction_type": "transfer", "description": "Save", "transaction_date": "2026-11-12", "transfer_pair": 0}]'
);
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000001'), 20.00, 'source: 70 - 50 = 20');
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000002'), 50.00, 'destination: 0 + 50 = 50');
SELECT is(
    (SELECT linked_transfer_transaction_id FROM public.account_transactions WHERE id = (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'transfer')),
    (SELECT pg_temp.leg(result, 1) FROM results WHERE name = 'transfer'), 'the source leg links to the destination leg'
);
SELECT is(
    (SELECT linked_transfer_transaction_id FROM public.account_transactions WHERE id = (SELECT pg_temp.leg(result, 1) FROM results WHERE name = 'transfer')),
    (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'transfer'), 'the destination leg links back'
);
SELECT is(
    (SELECT linked_account_transaction_id FROM public.transactions WHERE id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'transfer')),
    (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'transfer'), 'the budget row links to the source leg'
);
SELECT is(
    (SELECT count(*)::INT FROM public.account_transactions WHERE linked_allocation_transaction_id = (SELECT (result->>'budget_row_id')::UUID FROM results WHERE name = 'transfer')),
    2, 'both legs link back to the budget row'
);

-- ---------------------------------------------------------------------------
-- Fees still fire
-- ---------------------------------------------------------------------------
INSERT INTO results SELECT 'overdraft', public.post_ledger_entries(
    '{"name": "Rent", "amount": -60, "transaction_date": "2026-11-13", "source": "manual"}',
    '[{"account_id": "c1700000-0000-0000-0000-000000000001", "amount": -60, "transaction_type": "withdrawal", "description": "Rent", "transaction_date": "2026-11-13"}]'
);
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000001'), -45.00, '20 - 60 = -40, within the overdraft: 5 fee, -45');
SELECT is(
    (SELECT amount || ' ' || description || ' ' || transaction_date FROM public.account_transactions
     WHERE fee_for_transaction_id = (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'overdraft')),
    '-5.00 Overdraft fee 2026-11-13', 'the overdraft fee hangs off the posted leg'
);

INSERT INTO results SELECT 'cash advance', public.post_ledger_entries(
    '{"name": "ATM", "amount": -300, "transaction_date": "2026-11-13", "source": "manual"}',
    '[{"account_id": "c1700000-0000-0000-0000-000000000003", "amount": 300, "transaction_type": "adjustment", "description": "ATM", "transaction_date": "2026-11-13", "is_cash_advance": true}]'
);
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000003'), 315.00, '300 advance, fee max(10, 5% of 300 = 15) = 15: 315');
SELECT is(
    (SELECT is_cash_advance FROM public.account_transactions WHERE id = (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'cash advance')),
    true, 'the leg keeps is_cash_advance'
);

-- ---------------------------------------------------------------------------
-- Interest legs: one per account per month
-- ---------------------------------------------------------------------------
SELECT lives_ok($$ SELECT public.post_ledger_entries(NULL,
    '[{"account_id": "c1700000-0000-0000-0000-000000000002", "amount": 1.25, "transaction_type": "interest", "description": "Monthly compound interest", "transaction_date": "2026-11-14", "interest_period": "2026-11-01"}]') $$,
    'the November interest leg posts');
SELECT throws_ok($$ SELECT public.post_ledger_entries(NULL,
    '[{"account_id": "c1700000-0000-0000-0000-000000000002", "amount": 1.25, "transaction_type": "interest", "description": "Monthly compound interest", "transaction_date": "2026-11-14", "interest_period": "2026-11-01"}]') $$,
    '23505', NULL, 'a second November interest leg is rejected');
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000002'), 51.25, 'the balance moved once: 50 + 1.25');

-- ---------------------------------------------------------------------------
-- Rejections leave nothing behind
-- ---------------------------------------------------------------------------
SELECT throws_ok($$ SELECT public.post_ledger_entries(
    '{"name": "Theft", "amount": -10, "transaction_date": "2026-11-13", "source": "manual"}',
    '[{"account_id": "c1700000-0000-0000-0000-000000000009", "amount": -10, "transaction_type": "withdrawal", "description": "Theft", "transaction_date": "2026-11-13"}]') $$,
    'P0002', NULL, 'a leg on another user''s account is rejected');
SELECT is((SELECT count(*)::INT FROM public.transactions WHERE name = 'Theft'), 0, 'its budget row is rolled back');

SELECT throws_ok($$ SELECT public.post_ledger_entries(
    '{"name": "Half", "amount": 10, "transaction_date": "2026-11-13", "source": "transfer"}',
    '[{"account_id": "c1700000-0000-0000-0000-000000000002", "amount": -10, "transaction_type": "transfer", "description": "Half", "transaction_date": "2026-11-13"},
      {"account_id": "c1700000-0000-0000-0000-000000000001", "transaction_type": "transfer", "description": "Half", "transaction_date": "2026-11-13"}]') $$,
    '22023', NULL, 'a leg with no amount is rejected');
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000002'), 51.25, 'the first leg''s balance change is rolled back');
SELECT is((SELECT count(*)::INT FROM public.transactions WHERE name = 'Half'), 0, 'no budget row is left');
SELECT is((SELECT count(*)::INT FROM public.account_transactions WHERE description = 'Half'), 0, 'no ledger row is left');

SELECT throws_ok($$ SELECT public.post_ledger_entries(NULL, '[]') $$, '22023', NULL, 'an empty post is rejected');

-- ---------------------------------------------------------------------------
-- Service role (the interest cron): RLS is bypassed, the leg takes the account owner
-- ---------------------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
SET LOCAL ROLE service_role;

INSERT INTO results SELECT 'service', public.post_ledger_entries(NULL,
    '[{"account_id": "c1700000-0000-0000-0000-000000000009", "amount": 2.08, "transaction_type": "interest", "description": "Monthly compound interest", "transaction_date": "2026-11-14", "interest_period": "2026-11-01"}]'
);
SELECT is(pg_temp.balance('c1700000-0000-0000-0000-000000000009'), 502.08, '500 + 2.08 interest');
SELECT is(
    (SELECT user_id::TEXT || ' ' || interest_period FROM public.account_transactions WHERE id = (SELECT pg_temp.leg(result, 0) FROM results WHERE name = 'service')),
    '17000000-0000-0000-0000-000000000002 2026-11-01', 'the interest leg belongs to the account owner and carries its period'
);
SELECT throws_ok($$ SELECT public.post_ledger_entries('{"name": "X", "amount": 1, "transaction_date": "2026-11-14"}', '[]') $$,
    '42501', NULL, 'a budget row without a signed-in user is rejected');

SELECT * FROM finish();
ROLLBACK;
