-- ============================================================================
-- pgTAP tests for get_contribution_summaries() (migration 013, issue #121).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- Expected figures are worked out by hand from the CRA rules in
-- docs/121-investment-contribution-tracking-spec.md.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.make_user(p_id UUID) RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO auth.users (id, email, instance_id, aud, role)
    VALUES (p_id, p_id || '@contribution-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
$$;

CREATE OR REPLACE FUNCTION pg_temp.act_as(p_id UUID) RETURNS VOID LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

CREATE OR REPLACE FUNCTION pg_temp.make_account(
    p_id UUID, p_user UUID, p_name TEXT, p_track BOOLEAN, p_plan TEXT,
    p_room DECIMAL DEFAULT NULL, p_room_as_of DATE DEFAULT NULL, p_annual DECIMAL DEFAULT NULL
) RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO public.accounts (
        id, user_id, name, account_type_id, current_balance, track_contribution_room, contribution_plan,
        contribution_room, contribution_room_as_of, annual_contribution_limit
    )
    SELECT p_id, p_user, p_name, t.id, 0, p_track, p_plan, p_room, p_room_as_of, p_annual
    FROM public.account_types t
    WHERE t.code = 'investment' AND t.user_id IS NULL
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tx(
    p_account UUID, p_amount DECIMAL, p_type TEXT, p_date DATE, p_id UUID DEFAULT gen_random_uuid()
) RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO public.account_transactions (id, account_id, user_id, amount, transaction_type, description, transaction_date)
    SELECT p_id, p_account, a.user_id, p_amount, p_type, 'test', p_date FROM public.accounts a WHERE a.id = p_account;
$$;

-- Records a transfer the way createUnifiedTransaction does: two linked rows.
CREATE OR REPLACE FUNCTION pg_temp.transfer(p_from UUID, p_to UUID, p_amount DECIMAL, p_date DATE) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_out UUID := gen_random_uuid();
    v_in UUID := gen_random_uuid();
BEGIN
    PERFORM pg_temp.tx(p_from, -p_amount, 'transfer', p_date, v_out);
    PERFORM pg_temp.tx(p_to, p_amount, 'transfer', p_date, v_in);
    UPDATE public.account_transactions SET linked_transfer_transaction_id = v_in WHERE id = v_out;
    UPDATE public.account_transactions SET linked_transfer_transaction_id = v_out WHERE id = v_in;
END;
$$;

-- Snapshot of the function's output for the acting user, so tests can read single fields.
CREATE OR REPLACE FUNCTION pg_temp.snapshot(p_year INTEGER, p_month INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    DROP TABLE IF EXISTS pg_temp.s;
    CREATE TEMP TABLE s AS SELECT * FROM public.get_contribution_summaries(p_year, p_month);
END;
$$;

-- ---------------------------------------------------------------------------
-- User 1: two TFSAs sharing one room, an "Other" account, an untracked account,
-- and an FHSA room with no accounts yet.
-- ---------------------------------------------------------------------------
SELECT pg_temp.make_user('11111111-0000-0000-0000-000000000001');
INSERT INTO public.contribution_rooms (user_id, plan, room, room_as_of) VALUES
    ('11111111-0000-0000-0000-000000000001', 'tfsa', 10000, '2025-01-01'),
    ('11111111-0000-0000-0000-000000000001', 'fhsa', 8000, '2026-01-01');

SELECT pg_temp.make_account('a1000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'TFSA A', true, 'tfsa');
SELECT pg_temp.make_account('a1000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'TFSA B', true, 'tfsa');
SELECT pg_temp.make_account('a1000000-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Brokerage', false, NULL);
SELECT pg_temp.make_account('a1000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Custom', true, 'other', 3000, '2026-01-01');
SELECT pg_temp.make_account('a1000000-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'Chequing', false, NULL);
-- The chequing account is not an investment account; re-type it so it stays out of every pool.
UPDATE public.accounts SET account_type_id = (SELECT id FROM public.account_types WHERE code = 'chequing' AND user_id IS NULL LIMIT 1)
WHERE id = 'a1000000-0000-0000-0000-000000000005';

SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000001', 3000, 'deposit', '2025-03-01');
SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000002', -2000, 'withdrawal', '2025-06-01');
SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000001', 1500, 'contribution', '2026-02-01');
SELECT pg_temp.transfer('a1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 500, '2026-10-05');
-- Growth and corrections never use room. (Refunds are excluded by the function too, but
-- account_transactions' CHECK constraint does not accept 'refund' rows yet.)
SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000001', 80, 'interest', '2026-10-06');
SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000001', 60, 'adjustment', '2026-10-08');
-- A direct transfer between the two TFSAs is a qualifying transfer: neither side counts.
SELECT pg_temp.transfer('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 1000, '2026-10-10');
SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000003', 900, 'deposit', '2026-10-02');
SELECT pg_temp.tx('a1000000-0000-0000-0000-000000000004', 1000, 'deposit', '2026-10-03');

SELECT pg_temp.act_as('11111111-0000-0000-0000-000000000001');

-- October 2026 ---------------------------------------------------------------
SELECT pg_temp.snapshot(2026, 10);

SELECT is((SELECT count(*) FROM s), 4::bigint, 'one pool per plan plus one per other investment account (chequing excluded)');
SELECT set_eq(
    'SELECT pool_key FROM s',
    ARRAY['tfsa', 'fhsa', 'a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004'],
    'pools: tfsa, fhsa, brokerage, custom'
);

SELECT set_eq(
    $$SELECT unnest(account_ids) FROM s WHERE pool_key = 'tfsa'$$,
    ARRAY['a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002']::uuid[],
    'both TFSA accounts share the TFSA pool'
);
SELECT is((SELECT month_contributions FROM s WHERE pool_key = 'tfsa'), 500.00, 'TFSA: only the chequing transfer counts this month');
SELECT is((SELECT month_withdrawals FROM s WHERE pool_key = 'tfsa'), 0.00, 'TFSA: the TFSA-to-TFSA transfer is not a withdrawal');
SELECT is((SELECT year_contributions FROM s WHERE pool_key = 'tfsa'), 2000.00, 'TFSA: 2026 contributions across both accounts');
SELECT is((SELECT lifetime_contributions FROM s WHERE pool_key = 'tfsa'), 5000.00, 'TFSA: every recorded contribution');
SELECT is((SELECT annual_limit FROM s WHERE pool_key = 'tfsa'), 7000.00, 'TFSA: 2026 CRA dollar limit');
SELECT is((SELECT annual_limit_source FROM s WHERE pool_key = 'tfsa'), 'cra', 'TFSA: limit comes from CRA');
SELECT is((SELECT annual_remaining FROM s WHERE pool_key = 'tfsa'), 5000.00, 'TFSA: annual room left');
SELECT is((SELECT room_as_of FROM s WHERE pool_key = 'tfsa'), '2025-01-01'::date, 'TFSA: room date from contribution_rooms');
SELECT is((SELECT room_added FROM s WHERE pool_key = 'tfsa'), 9000.00, 'TFSA: 2026 limit (7000) + 2025 withdrawal restored (2000)');
SELECT is((SELECT room_used FROM s WHERE pool_key = 'tfsa'), 5000.00, 'TFSA: contributions since the room date');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'tfsa'), 14000.00, 'TFSA: 10000 + 9000 - 5000');
SELECT is((SELECT room_needs_update FROM s WHERE pool_key = 'tfsa'), false, 'TFSA: rolls forward, never stale');
SELECT is(
    (SELECT accounts FROM s WHERE pool_key = 'tfsa'),
    '[{"account_id": "a1000000-0000-0000-0000-000000000001", "month_contributions": 0, "year_contributions": 1500.00},
      {"account_id": "a1000000-0000-0000-0000-000000000002", "month_contributions": 500.00, "year_contributions": 500.00}]'::jsonb,
    'TFSA: per-account shares'
);

SELECT is((SELECT tracks_room FROM s WHERE pool_key = 'a1000000-0000-0000-0000-000000000003'), false, 'brokerage: untracked');
SELECT is((SELECT month_contributions FROM s WHERE pool_key = 'a1000000-0000-0000-0000-000000000003'), 900.00, 'brokerage: deposits still reported');
SELECT ok((SELECT annual_limit IS NULL AND room_remaining IS NULL FROM s WHERE pool_key = 'a1000000-0000-0000-0000-000000000003'), 'brokerage: no limits');

SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'a1000000-0000-0000-0000-000000000004'), 2000.00, 'Other: own room 3000 - 1000');
SELECT ok((SELECT annual_limit IS NULL FROM s WHERE pool_key = 'a1000000-0000-0000-0000-000000000004'), 'Other: no CRA annual limit');

SELECT is((SELECT cardinality(account_ids) FROM s WHERE pool_key = 'fhsa'), 0, 'FHSA: room row with no accounts still has a pool');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'fhsa'), 8000.00, 'FHSA: room untouched');
SELECT is((SELECT annual_limit FROM s WHERE pool_key = 'fhsa'), 8000.00, 'FHSA: $8,000 a year');
SELECT is((SELECT lifetime_limit FROM s WHERE pool_key = 'fhsa'), 40000.00, 'FHSA: $40,000 lifetime');

-- December 2025: before the January roll-forward ------------------------------
SELECT pg_temp.snapshot(2025, 12);
SELECT is((SELECT year_contributions FROM s WHERE pool_key = 'tfsa'), 3000.00, 'Dec 2025: 2025 contributions');
SELECT is((SELECT year_withdrawals FROM s WHERE pool_key = 'tfsa'), 2000.00, 'Dec 2025: 2025 withdrawals');
SELECT is((SELECT annual_remaining FROM s WHERE pool_key = 'tfsa'), 4000.00, 'Dec 2025: 7000 - 3000');
SELECT is((SELECT room_added FROM s WHERE pool_key = 'tfsa'), 0.00, 'Dec 2025: withdrawal not restored until January');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'tfsa'), 7000.00, 'Dec 2025: 10000 - 3000');

-- January 2026: new limit and the restored withdrawal arrive -------------------
SELECT pg_temp.snapshot(2026, 1);
SELECT is((SELECT room_added FROM s WHERE pool_key = 'tfsa'), 9000.00, 'Jan 2026: 7000 new + 2000 restored');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'tfsa'), 16000.00, 'Jan 2026: 10000 + 9000 - 3000');

-- December 2024: before the room date ------------------------------------------
SELECT pg_temp.snapshot(2024, 12);
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'tfsa'), 10000.00, 'before the room date nothing is used or added');

-- Figures are derived on read: editing the ledger changes them immediately -----
UPDATE public.account_transactions SET amount = 700
WHERE account_id = 'a1000000-0000-0000-0000-000000000002' AND transaction_date = '2026-10-05';
DELETE FROM public.account_transactions
WHERE account_id = 'a1000000-0000-0000-0000-000000000001' AND transaction_date = '2026-02-01';
SELECT pg_temp.snapshot(2026, 10);
SELECT is((SELECT month_contributions FROM s WHERE pool_key = 'tfsa'), 700.00, 'edited transfer is reflected');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'tfsa'), 15300.00, '10000 + 9000 - (3000 + 700) after edit and delete');

-- Untracking an account removes it from the plan pool --------------------------
UPDATE public.accounts SET track_contribution_room = false WHERE id = 'a1000000-0000-0000-0000-000000000002';
SELECT pg_temp.snapshot(2026, 10);
-- TFSA B's $700 contribution and its 2025 $2,000 withdrawal both leave the pool.
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'tfsa'), 14000.00, 'untracked TFSA B leaves the pool: 10000 + 7000 - 3000');
SELECT is((SELECT tracks_room FROM s WHERE pool_key = 'a1000000-0000-0000-0000-000000000002'), false, 'TFSA B becomes its own untracked pool');
UPDATE public.accounts SET track_contribution_room = true WHERE id = 'a1000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- User 2: RRSP with an annual override, a stale room date, and an FHSA -> RRSP
-- transfer (which does not use RRSP room).
-- ---------------------------------------------------------------------------
SELECT pg_temp.make_user('22222222-0000-0000-0000-000000000002');
INSERT INTO public.contribution_rooms (user_id, plan, room, room_as_of, annual_limit) VALUES
    ('22222222-0000-0000-0000-000000000002', 'rrsp', 20000, '2025-05-01', 12000),
    ('22222222-0000-0000-0000-000000000002', 'fhsa', 8000, '2026-01-01', NULL);
SELECT pg_temp.make_account('b2000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'RRSP', true, 'rrsp');
SELECT pg_temp.make_account('b2000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'FHSA', true, 'fhsa');
SELECT pg_temp.tx('b2000000-0000-0000-0000-000000000001', 2000, 'deposit', '2025-06-01');
SELECT pg_temp.tx('b2000000-0000-0000-0000-000000000001', 4000, 'deposit', '2026-03-01');
SELECT pg_temp.tx('b2000000-0000-0000-0000-000000000002', 3000, 'deposit', '2026-02-01');
SELECT pg_temp.transfer('b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 1000, '2026-04-01');

SELECT pg_temp.act_as('22222222-0000-0000-0000-000000000002');

SELECT pg_temp.snapshot(2026, 10);
SELECT is((SELECT year_contributions FROM s WHERE pool_key = 'rrsp'), 4000.00, 'RRSP: FHSA -> RRSP transfer does not count');
SELECT is((SELECT annual_limit FROM s WHERE pool_key = 'rrsp'), 33810.00, 'RRSP: the 2025 override does not apply to 2026');
SELECT is((SELECT annual_limit_source FROM s WHERE pool_key = 'rrsp'), 'cra', 'RRSP: falls back to the CRA maximum');
SELECT is((SELECT room_used FROM s WHERE pool_key = 'rrsp'), 6000.00, 'RRSP: contributions since 2025-05-01');
SELECT is((SELECT room_added FROM s WHERE pool_key = 'rrsp'), 0.00, 'RRSP: room is never rolled forward');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'rrsp'), 14000.00, 'RRSP: 20000 - 6000');
SELECT is((SELECT room_needs_update FROM s WHERE pool_key = 'rrsp'), true, 'RRSP: room from 2025 needs a fresh CRA figure');
SELECT is((SELECT year_contributions FROM s WHERE pool_key = 'fhsa'), 3000.00, 'FHSA: deposit counts');
SELECT is((SELECT year_withdrawals FROM s WHERE pool_key = 'fhsa'), 1000.00, 'FHSA: transfer out to the RRSP is a withdrawal');
SELECT is((SELECT room_remaining FROM s WHERE pool_key = 'fhsa'), 5000.00, 'FHSA: withdrawals do not restore room');
SELECT is((SELECT room_needs_update FROM s WHERE pool_key = 'fhsa'), false, 'FHSA: room entered this year is current');

SELECT pg_temp.snapshot(2025, 10);
SELECT is((SELECT annual_limit FROM s WHERE pool_key = 'rrsp'), 12000.00, 'RRSP: override applies to its own year');
SELECT is((SELECT annual_limit_source FROM s WHERE pool_key = 'rrsp'), 'account', 'RRSP: 2025 limit is the user''s figure');
SELECT is((SELECT annual_remaining FROM s WHERE pool_key = 'rrsp'), 10000.00, 'RRSP: 12000 - 2000');
SELECT is((SELECT room_needs_update FROM s WHERE pool_key = 'rrsp'), false, 'RRSP: not stale within its own year');

-- ---------------------------------------------------------------------------
-- Isolation: a user only ever sees their own pools and rooms.
-- ---------------------------------------------------------------------------
SELECT pg_temp.make_user('33333333-0000-0000-0000-000000000003');
SELECT pg_temp.act_as('33333333-0000-0000-0000-000000000003');
SET LOCAL ROLE authenticated;

SELECT is((SELECT count(*) FROM public.get_contribution_summaries(2026, 10)), 0::bigint, 'a new user has no pools');
SELECT is((SELECT count(*) FROM public.contribution_rooms), 0::bigint, 'RLS hides other users'' rooms');
SELECT throws_ok(
    $$INSERT INTO public.contribution_rooms (user_id, plan, room) VALUES ('11111111-0000-0000-0000-000000000001', 'rrsp', 1)$$,
    '42501',
    NULL,
    'RLS blocks writing another user''s room'
);
SELECT lives_ok(
    $$INSERT INTO public.contribution_rooms (user_id, plan, room) VALUES ('33333333-0000-0000-0000-000000000003', 'tfsa', 500)$$,
    'a user can save their own room'
);
SELECT is((SELECT count(*) FROM public.get_contribution_summaries(2026, 10)), 1::bigint, 'their room shows up as a pool');

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
