-- ============================================================================
-- pgTAP tests for contribution_room_walk(): remaining room and the estimated CRA
-- over-contribution tax (migration 013, issue #121).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
--
-- CRA charges 1% per month on the excess while it lasts: TFSA and FHSA on the highest excess
-- in the month, RRSP on the month-end excess above the $2,000 buffer, RESP on the month-end
-- excess. Every expected figure below is worked out by hand in the comment above it.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- Shorthand: walk a pool with room R as of 2026-01-01 up to the given period end.
CREATE OR REPLACE FUNCTION pg_temp.walk(p_plan TEXT, p_room DECIMAL, p_period_end DATE, p_flows TEXT)
RETURNS TABLE (
    room_added DECIMAL(15, 2), room_used DECIMAL(15, 2), room_remaining DECIMAL(15, 2), excess_amount DECIMAL(15, 2),
    tax_this_month DECIMAL(15, 2), tax_this_year DECIMAL(15, 2), tax_total DECIMAL(15, 2), taxed_months INTEGER
) LANGUAGE sql AS $$
    SELECT * FROM public.contribution_room_walk(p_plan, p_room, '2026-01-01', p_period_end, p_flows::jsonb);
$$;

-- ---------------------------------------------------------------------------
-- Within the room: no tax
-- ---------------------------------------------------------------------------
-- $1,000 room, $600 in on Mar 1 -> $400 left, nothing taxed.
SELECT results_eq(
    $$SELECT room_used, room_remaining, excess_amount, tax_total, taxed_months
      FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2026-03-01","a":600}]')$$,
    $$VALUES (600.00::DECIMAL(15, 2), 400.00::DECIMAL(15, 2), 0.00::DECIMAL(15, 2), 0.00::DECIMAL(15, 2), 0)$$,
    'within the room: room left, no excess, no tax'
);

-- Exactly using the room is not an excess.
SELECT is((SELECT tax_total FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2026-03-01","a":1000}]')), 0.00,
    'using exactly all the room is not taxed');

-- ---------------------------------------------------------------------------
-- TFSA: excess that stays
-- ---------------------------------------------------------------------------
-- $1,500 in on Mar 10 against $1,000 room -> $500 excess from March to October:
-- 8 months x 1% x $500 = $40.
SELECT results_eq(
    $$SELECT room_used, room_remaining, excess_amount, tax_this_month, tax_this_year, tax_total, taxed_months
      FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2026-03-10","a":1500}]')$$,
    $$VALUES (1500.00::DECIMAL(15, 2), -500.00::DECIMAL(15, 2), 500.00::DECIMAL(15, 2),
              5.00::DECIMAL(15, 2), 40.00::DECIMAL(15, 2), 40.00::DECIMAL(15, 2), 8)$$,
    'TFSA excess of $500 for 8 months costs $40, $5 a month'
);

-- Adding $300 more on May 15 raises the excess to $800 from May:
-- Mar, Apr $5 each + May..Oct 6 x $8 = $10 + $48 = $58.
SELECT results_eq(
    $$SELECT excess_amount, tax_this_month, tax_total, taxed_months
      FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2026-03-10","a":1500},{"d":"2026-05-15","a":300}]')$$,
    $$VALUES (800.00::DECIMAL(15, 2), 8.00::DECIMAL(15, 2), 58.00::DECIMAL(15, 2), 8)$$,
    'adding on top of an excess raises the monthly tax from that month'
);

-- The tax for a month uses the highest excess in it: over by $500 on Mar 10, by $900 on
-- Mar 12, back to $200 after a $700 withdrawal on Mar 25 -> March is charged on $900 ($9),
-- April..May on $200 ($2 each). Period May: $9 + $2 + $2 = $13.
SELECT is(
    (SELECT tax_total FROM pg_temp.walk('tfsa', 1000, '2026-05-31',
        '[{"d":"2026-03-10","a":1500},{"d":"2026-03-12","a":400},{"d":"2026-03-25","a":-700}]')),
    13.00,
    'TFSA tax uses the highest excess in the month'
);

-- ---------------------------------------------------------------------------
-- Withdrawals clear the excess
-- ---------------------------------------------------------------------------
-- Over by $500 on Mar 10, $500 withdrawn on Mar 20 -> only March is taxed ($5).
-- The withdrawal cleared the excess, so it is not counted as room used.
SELECT results_eq(
    $$SELECT room_used, room_remaining, excess_amount, tax_this_month, tax_total, taxed_months
      FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2026-03-10","a":1500},{"d":"2026-03-20","a":-500}]')$$,
    $$VALUES (1000.00::DECIMAL(15, 2), 0.00::DECIMAL(15, 2), 0.00::DECIMAL(15, 2),
              0.00::DECIMAL(15, 2), 5.00::DECIMAL(15, 2), 1)$$,
    'withdrawing the excess stops the tax after that month'
);

-- Over by $500 on Mar 10, $800 withdrawn on Apr 5: the excess still existed in April, so
-- March and April are taxed ($5 + $5). $500 cleared the excess; only the other $300 is
-- added back on 1 January 2027 together with the 2027 limit ($7,000).
SELECT results_eq(
    $$SELECT tax_total, taxed_months
      FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2026-03-10","a":1500},{"d":"2026-04-05","a":-800}]')$$,
    $$VALUES (10.00::DECIMAL(15, 2), 2)$$,
    'an excess that lasts into a month is taxed for that month'
);
SELECT results_eq(
    $$SELECT room_added, room_used, room_remaining, tax_this_year, tax_total
      FROM pg_temp.walk('tfsa', 1000, '2027-01-31', '[{"d":"2026-03-10","a":1500},{"d":"2026-04-05","a":-800}]')$$,
    $$VALUES (7300.00::DECIMAL(15, 2), 1000.00::DECIMAL(15, 2), 7300.00::DECIMAL(15, 2),
              0.00::DECIMAL(15, 2), 10.00::DECIMAL(15, 2))$$,
    'only the part of a TFSA withdrawal that did not clear an excess comes back next year'
);

-- ---------------------------------------------------------------------------
-- 1 January: new TFSA room absorbs the excess
-- ---------------------------------------------------------------------------
-- Over by $500 on Dec 10, 2026 -> December taxed ($5). On 1 January 2027 the new $7,000
-- absorbs the excess: $1,000 + $7,000 - $1,500 = $6,500 left, nothing taxed in 2027.
SELECT results_eq(
    $$SELECT room_added, room_remaining, excess_amount, tax_this_year, tax_total, taxed_months
      FROM pg_temp.walk('tfsa', 1000, '2027-02-28', '[{"d":"2026-12-10","a":1500}]')$$,
    $$VALUES (7000.00::DECIMAL(15, 2), 6500.00::DECIMAL(15, 2), 0.00::DECIMAL(15, 2),
              0.00::DECIMAL(15, 2), 5.00::DECIMAL(15, 2), 1)$$,
    'the new year''s TFSA room absorbs an excess and the tax stops'
);

-- An excess bigger than the new limit stays: over by $8,000 on Dec 10, 2026 ($80 for
-- December); 1 January 2027 adds $7,000, leaving $1,000 excess -> January $10, February $10.
SELECT results_eq(
    $$SELECT room_remaining, excess_amount, tax_this_month, tax_this_year, tax_total
      FROM pg_temp.walk('tfsa', 1000, '2027-02-28', '[{"d":"2026-12-10","a":9000}]')$$,
    $$VALUES (-1000.00::DECIMAL(15, 2), 1000.00::DECIMAL(15, 2), 10.00::DECIMAL(15, 2),
              20.00::DECIMAL(15, 2), 100.00::DECIMAL(15, 2))$$,
    'an excess larger than the new limit keeps being taxed on what is left'
);

-- ---------------------------------------------------------------------------
-- RRSP: $2,000 buffer, month-end excess
-- ---------------------------------------------------------------------------
-- $3,500 in against $1,000 room -> $2,500 excess, $500 above the buffer: $5 a month for
-- March..October = $40. RRSP room is never rolled forward.
SELECT results_eq(
    $$SELECT room_added, excess_amount, tax_this_month, tax_total, taxed_months
      FROM pg_temp.walk('rrsp', 1000, '2026-10-31', '[{"d":"2026-03-10","a":3500}]')$$,
    $$VALUES (0.00::DECIMAL(15, 2), 2500.00::DECIMAL(15, 2), 5.00::DECIMAL(15, 2), 40.00::DECIMAL(15, 2), 8)$$,
    'RRSP is taxed only on the excess above $2,000'
);
SELECT is((SELECT tax_total FROM pg_temp.walk('rrsp', 1000, '2026-10-31', '[{"d":"2026-03-10","a":3000}]')), 0.00,
    'an RRSP excess within the $2,000 buffer is not taxed');
-- RRSP uses the month-end excess: over by $2,500 on Mar 10, back within the buffer on Mar 20.
SELECT is((SELECT tax_total FROM pg_temp.walk('rrsp', 1000, '2026-10-31',
        '[{"d":"2026-03-10","a":3500},{"d":"2026-03-20","a":-600}]')), 0.00,
    'an RRSP excess cleared before month end is not taxed');

-- ---------------------------------------------------------------------------
-- FHSA (highest in month) vs RESP (month end)
-- ---------------------------------------------------------------------------
-- Over by $500 on Mar 10, withdrawn on Mar 20.
SELECT is((SELECT tax_total FROM pg_temp.walk('fhsa', 1000, '2026-10-31',
        '[{"d":"2026-03-10","a":1500},{"d":"2026-03-20","a":-500}]')), 5.00,
    'FHSA is taxed on the highest excess in the month');
SELECT is((SELECT tax_total FROM pg_temp.walk('resp', 1000, '2026-10-31',
        '[{"d":"2026-03-10","a":1500},{"d":"2026-03-20","a":-500}]')), 0.00,
    'RESP is taxed on the month-end excess');
-- An RESP excess that stays: $500 from March to October = 8 x $5 = $40.
SELECT is((SELECT tax_total FROM pg_temp.walk('resp', 1000, '2026-10-31', '[{"d":"2026-03-10","a":1500}]')), 40.00,
    'RESP excess that stays is taxed every month');

-- ---------------------------------------------------------------------------
-- Other plans, dates and rounding
-- ---------------------------------------------------------------------------
SELECT results_eq(
    $$SELECT room_remaining, excess_amount, tax_total FROM pg_temp.walk('other', 1000, '2026-10-31', '[{"d":"2026-03-10","a":1500}]')$$,
    $$VALUES (-500.00::DECIMAL(15, 2), 500.00::DECIMAL(15, 2), 0.00::DECIMAL(15, 2))$$,
    'Other accounts can go over their room but have no CRA tax'
);
SELECT is((SELECT room_used FROM pg_temp.walk('tfsa', 1000, '2026-10-31', '[{"d":"2025-12-01","a":900}]')), 0.00,
    'contributions before the room date are already in CRA''s figure');
SELECT results_eq(
    $$SELECT room_used, room_remaining FROM public.contribution_room_walk('tfsa', 1000, '2026-01-01', '2025-12-31', '[]'::jsonb)$$,
    $$VALUES (0.00::DECIMAL(15, 2), 1000.00::DECIMAL(15, 2))$$,
    'before the room date nothing is used'
);
-- Room entered for 2025 rolls forward with the 2026 limit.
SELECT is((SELECT room_added FROM public.contribution_room_walk('tfsa', 0, '2025-01-01', '2026-10-31', '[]'::jsonb)), 7000.00,
    'TFSA room entered last year gets this year''s limit');
-- $1,333.33 against $1,000 -> $333.33 excess; 1% = $3.33 for the month.
SELECT is((SELECT tax_this_month FROM pg_temp.walk('tfsa', 1000, '2026-03-31', '[{"d":"2026-03-10","a":1333.33}]')), 3.33,
    'the monthly tax is rounded to the cent');
-- Same-day deposit and withdrawal: the deposit counts first, so the momentary excess is taxed.
SELECT is((SELECT tax_total FROM pg_temp.walk('tfsa', 1000, '2026-03-31',
        '[{"d":"2026-03-10","a":-300},{"d":"2026-03-10","a":1300}]')), 3.00,
    'same-day contributions are applied before withdrawals');

-- ---------------------------------------------------------------------------
-- Through get_contribution_summaries(): tax columns for a real pool
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('55555555-0000-0000-0000-000000000005', 'tax-test@contribution-test.test',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
INSERT INTO public.contribution_rooms (user_id, plan, room, room_as_of)
VALUES ('55555555-0000-0000-0000-000000000005', 'tfsa', 1000, '2026-01-01');
INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance, track_contribution_room, contribution_plan)
SELECT 'e5000000-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000005', 'TFSA', t.id, 0, true, 'tfsa'
FROM public.account_types t WHERE t.code = 'investment' AND t.user_id IS NULL LIMIT 1;
INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance, track_contribution_room)
SELECT 'e5000000-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000005', 'Brokerage', t.id, 0, false
FROM public.account_types t WHERE t.code = 'investment' AND t.user_id IS NULL LIMIT 1;
INSERT INTO public.account_transactions (account_id, user_id, amount, transaction_type, description, transaction_date) VALUES
    ('e5000000-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000005', 1500, 'deposit', 'test', '2026-03-10'),
    ('e5000000-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000005', 5000, 'deposit', 'test', '2026-03-10');
SELECT set_config('request.jwt.claims', '{"sub":"55555555-0000-0000-0000-000000000005","role":"authenticated"}', true);

SELECT results_eq(
    $$SELECT room_remaining, excess_amount, tax_this_month, tax_this_year, tax_total, taxed_months
      FROM public.get_contribution_summaries(2026, 10) WHERE pool_key = 'tfsa'$$,
    $$VALUES (-500.00::DECIMAL(15, 2), 500.00::DECIMAL(15, 2), 5.00::DECIMAL(15, 2),
              40.00::DECIMAL(15, 2), 40.00::DECIMAL(15, 2), 8)$$,
    'summaries carry the TFSA excess and tax'
);
SELECT ok(
    (SELECT tax_total IS NULL AND excess_amount IS NULL FROM public.get_contribution_summaries(2026, 10)
     WHERE pool_key = 'e5000000-0000-0000-0000-000000000002'),
    'untracked accounts have no tax figures'
);

SELECT * FROM finish();
ROLLBACK;
