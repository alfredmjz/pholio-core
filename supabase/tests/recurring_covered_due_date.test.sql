-- ============================================================================
-- pgTAP tests for recurring occurrence markers keyed on the covered due date (migration 011).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
--
-- A bill paid early is recorded today (transaction_date) for a later due date (covers_due_date).
-- Its marker in recurring_recorded_occurrences must sit on the due date, so auto-pay never
-- records that bill again.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

CREATE OR REPLACE FUNCTION pg_temp.markers(p_bill UUID) RETURNS TEXT
LANGUAGE sql AS $$
    SELECT COALESCE(string_agg(occurrence_date::TEXT, ',' ORDER BY occurrence_date), '')
    FROM public.recurring_recorded_occurrences WHERE recurring_expense_id = p_bill;
$$;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('99999999-0000-0000-0000-000000000001', 'owner@covered-due-date-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.recurring_expenses (id, user_id, name, amount, billing_period, next_due_date, category)
VALUES ('b9000000-0000-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'Phone', 60, '2:weeks', '2026-11-25', 'bill');

SELECT set_config('request.jwt.claims', json_build_object('sub', '99999999-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

-- An older payment with no covered date keeps its marker on the transaction date.
INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source, recurring_expense_id)
VALUES ('d9000000-0000-0000-0000-000000000001', auth.uid(), 'Phone', -60, '2026-10-25', 'recurring', 'b9000000-0000-0000-0000-000000000001');
SELECT is(pg_temp.markers('b9000000-0000-0000-0000-000000000001'), '2026-10-25', 'a payment without a covered date marks its own date');

-- Two bills paid early on Oct 26 for Nov 25 and Dec 9.
INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source, recurring_expense_id, covers_due_date)
VALUES
    ('d9000000-0000-0000-0000-000000000002', auth.uid(), 'Phone', -60, '2026-10-26', 'recurring', 'b9000000-0000-0000-0000-000000000001', '2026-11-25'),
    ('d9000000-0000-0000-0000-000000000003', auth.uid(), 'Phone', -60, '2026-10-26', 'recurring', 'b9000000-0000-0000-0000-000000000001', '2026-12-09');
SELECT is(
    pg_temp.markers('b9000000-0000-0000-0000-000000000001'),
    '2026-10-25,2026-11-25,2026-12-09',
    'early payments mark the due dates they cover, not the day they were paid'
);

-- Moving the payment's date leaves the bill it covers alone.
UPDATE public.transactions SET transaction_date = '2026-10-27' WHERE id = 'd9000000-0000-0000-0000-000000000002';
SELECT is(
    pg_temp.markers('b9000000-0000-0000-0000-000000000001'),
    '2026-10-25,2026-11-25,2026-12-09',
    'editing the payment date keeps the covered due date marked'
);

-- Changing the covered date moves the marker.
UPDATE public.transactions SET covers_due_date = '2026-12-23' WHERE id = 'd9000000-0000-0000-0000-000000000003';
SELECT is(
    pg_temp.markers('b9000000-0000-0000-0000-000000000001'),
    '2026-10-25,2026-11-25,2026-12-23',
    'changing the covered date moves its marker'
);

-- A marker stays while another payment still covers that due date.
INSERT INTO public.transactions (id, user_id, name, amount, transaction_date, source, recurring_expense_id, covers_due_date)
VALUES ('d9000000-0000-0000-0000-000000000004', auth.uid(), 'Phone', -10, '2026-10-28', 'recurring', 'b9000000-0000-0000-0000-000000000001', '2026-11-25');
UPDATE public.transactions SET covers_due_date = '2027-01-06' WHERE id = 'd9000000-0000-0000-0000-000000000004';
SELECT is(
    pg_temp.markers('b9000000-0000-0000-0000-000000000001'),
    '2026-10-25,2026-11-25,2026-12-23,2027-01-06',
    'a due date still covered by another payment keeps its marker'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
