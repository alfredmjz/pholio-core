-- ============================================================================
-- pgTAP tests for the contributed-this-year figure (migration 018).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- Two TFSAs share $20,000 room as of 1 January 2026 (CRA annual limit $7,000):
--   A +1,000 on 1 Feb, B +500 on 1 Apr, A +300 on 1 Aug  (ledger total for 2026: 1,800).
-- The user says they contributed $4,000 up to 30 June. Ledger to 30 June is 1,500, so the
-- correction is +2,500 and the August deposit adds on top: 4,300 for the year.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('44444444-0000-0000-0000-000000000004', 'override@contribution-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance, track_contribution_room, contribution_plan)
SELECT v.id, '44444444-0000-0000-0000-000000000004', v.name, t.id, 0, true, 'tfsa'
FROM (VALUES ('b4000000-0000-0000-0000-000000000001'::uuid, 'TFSA A'), ('b4000000-0000-0000-0000-000000000002'::uuid, 'TFSA B')) AS v(id, name)
CROSS JOIN LATERAL (SELECT id FROM public.account_types WHERE code = 'investment' AND user_id IS NULL LIMIT 1) t;

INSERT INTO public.account_transactions (account_id, user_id, amount, transaction_type, description, transaction_date) VALUES
    ('b4000000-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004', 1000, 'deposit', 'test', '2026-02-01'),
    ('b4000000-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000004', 500, 'deposit', 'test', '2026-04-01'),
    ('b4000000-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000004', 300, 'deposit', 'test', '2026-08-01');

INSERT INTO public.contribution_rooms (user_id, plan, room, room_as_of, year_contributed, year_contributed_as_of)
VALUES ('44444444-0000-0000-0000-000000000004', 'tfsa', 20000, '2026-01-01', 4000, '2026-06-30');

SELECT set_config('request.jwt.claims', json_build_object('sub', '44444444-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);

CREATE OR REPLACE FUNCTION pg_temp.snapshot(p_year INTEGER, p_month INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    DROP TABLE IF EXISTS pg_temp.s;
    CREATE TEMP TABLE s AS SELECT * FROM public.get_contribution_summaries(p_year, p_month) WHERE pool_key = 'tfsa';
END;
$$;

-- November 2026: the figure applies, the August deposit adds on top ------------
SELECT pg_temp.snapshot(2026, 11);
SELECT is((SELECT year_contributions FROM s), 4300.00, 'year: 4,000 figure + 300 after its date');
SELECT is((SELECT lifetime_contributions FROM s), 4300.00, 'lifetime takes the same correction');
SELECT is((SELECT annual_remaining FROM s), 2700.00, 'annual remaining: 7,000 - 4,300');
SELECT is((SELECT room_used FROM s), 4300.00, 'room used: 1,800 + 2,500');
SELECT is((SELECT room_remaining FROM s), 15700.00, 'room remaining: 20,000 - 4,300');
SELECT is((SELECT contributed_override FROM s), 4000.00, 'the figure is returned');
SELECT is((SELECT contributed_as_of FROM s), '2026-06-30'::date, 'with its date');
SELECT is((SELECT month_contributions FROM s), 0.00, 'month figures stay ledger-only');

-- May 2026: before the figure's date, so the ledger total stands ---------------
SELECT pg_temp.snapshot(2026, 5);
SELECT is((SELECT year_contributions FROM s), 1500.00, 'before the as-of date the ledger total stands');
SELECT is((SELECT contributed_override FROM s), NULL::DECIMAL, 'and no figure is returned');

-- March 2027: a figure for 2026 does not carry into the next year --------------
SELECT pg_temp.snapshot(2027, 3);
SELECT is((SELECT year_contributions FROM s), 0.00, 'a 2026 figure does not apply in 2027');
SELECT is((SELECT lifetime_contributions FROM s), 1800.00, 'lifetime drops back to the ledger total');
SELECT is((SELECT contributed_override FROM s), NULL::DECIMAL, 'no figure in 2027');

-- A figure below the ledger total lowers it ------------------------------------
UPDATE public.contribution_rooms SET year_contributed = 1000 WHERE user_id = '44444444-0000-0000-0000-000000000004';
SELECT pg_temp.snapshot(2026, 11);
SELECT is((SELECT year_contributions FROM s), 1300.00, 'year: 1,000 figure + 300 after its date');
SELECT is((SELECT room_remaining FROM s), 18700.00, 'room remaining: 20,000 - 1,300');

-- Clearing the figure goes back to the ledger total ----------------------------
UPDATE public.contribution_rooms SET year_contributed = NULL, year_contributed_as_of = NULL WHERE user_id = '44444444-0000-0000-0000-000000000004';
SELECT pg_temp.snapshot(2026, 11);
SELECT is((SELECT year_contributions FROM s), 1800.00, 'cleared: ledger total');
SELECT is((SELECT room_used FROM s), 1800.00, 'cleared: room used from the ledger');

SELECT * FROM finish();
ROLLBACK;
