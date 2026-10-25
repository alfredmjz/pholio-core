-- ============================================================================
-- pgTAP tests for user preferences and the reminder send log (migration 009),
-- and for deleting an account from Settings, which deletes the auth user.
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
-- Everything runs in one transaction and is rolled back.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

CREATE OR REPLACE FUNCTION pg_temp.make_user(p_id UUID) RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO auth.users (id, email, instance_id, aud, role)
    VALUES (p_id, p_id || '@preferences-test.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
$$;

CREATE OR REPLACE FUNCTION pg_temp.act_as(p_id UUID) RETURNS VOID LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

SELECT pg_temp.make_user('aaaaaaaa-0000-0000-0000-000000000001');
SELECT pg_temp.make_user('bbbbbbbb-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Preference columns
-- ---------------------------------------------------------------------------
SELECT results_eq(
    $$SELECT default_currency, locale, notify_in_app, notify_email, notify_lead_days, changelog_seen_at
      FROM public.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    $$VALUES ('CAD'::TEXT, 'en-CA'::TEXT, true, false, 3::SMALLINT, NULL::TIMESTAMPTZ)$$,
    'a new user starts in CAD, en-CA, reminders in the app only, 3 days ahead, What''s new never opened'
);

SELECT lives_ok(
    $$UPDATE public.users SET default_currency = 'EUR', locale = 'fr-FR', notify_email = true, notify_lead_days = 14
      WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    'every listed value can be saved'
);
SELECT throws_ok(
    $$UPDATE public.users SET default_currency = 'BTC' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    '23514', NULL, 'an unlisted currency is refused'
);
SELECT throws_ok(
    $$UPDATE public.users SET locale = 'de-DE' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    '23514', NULL, 'an unlisted format is refused'
);
SELECT throws_ok(
    $$UPDATE public.users SET notify_lead_days = 0 WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    '23514', NULL, 'reminders need at least 1 day of lead time'
);
SELECT throws_ok(
    $$UPDATE public.users SET notify_lead_days = 15 WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    '23514', NULL, 'reminders can be at most 14 days ahead'
);

-- ---------------------------------------------------------------------------
-- Send log: one email per item and due date
-- ---------------------------------------------------------------------------
INSERT INTO public.notification_sends (user_id, kind, ref_id, due_date)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'card_due', 'cccccccc-0000-0000-0000-000000000003', '2026-10-27');

SELECT throws_ok(
    $$INSERT INTO public.notification_sends (user_id, kind, ref_id, due_date)
      VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'card_due', 'cccccccc-0000-0000-0000-000000000003', '2026-10-27')$$,
    '23505', NULL, 'the same item and due date is logged once'
);
SELECT lives_ok(
    $$INSERT INTO public.notification_sends (user_id, kind, ref_id, due_date)
      VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'card_due', 'cccccccc-0000-0000-0000-000000000003', '2026-11-27')$$,
    'next month''s due date is a new reminder'
);

-- The cron's claim: ON CONFLICT DO NOTHING returns only the rows it actually added.
CREATE OR REPLACE FUNCTION pg_temp.claim_both() RETURNS SETOF TEXT LANGUAGE sql AS $$
    INSERT INTO public.notification_sends (user_id, kind, ref_id, due_date)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'card_due', 'cccccccc-0000-0000-0000-000000000003', '2026-10-27'),
           ('aaaaaaaa-0000-0000-0000-000000000001', 'recurring_due', 'dddddddd-0000-0000-0000-000000000004', '2026-10-26')
    ON CONFLICT (user_id, kind, ref_id, due_date) DO NOTHING
    RETURNING kind;
$$;
SELECT results_eq(
    $$SELECT * FROM pg_temp.claim_both()$$,
    $$VALUES ('recurring_due'::TEXT)$$,
    'a second run claims only what wasn''t sent yet'
);

SELECT throws_ok(
    $$INSERT INTO public.notification_sends (user_id, kind, ref_id, due_date)
      VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'sms', gen_random_uuid(), '2026-10-27')$$,
    '23514', NULL, 'only known kinds are logged'
);

-- Signed-in users can't see or change the log, not even their own rows.
SELECT pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT count(*) FROM public.notification_sends$$, '42501', NULL, 'a user can''t read the send log');
SELECT throws_ok(
    $$DELETE FROM public.notification_sends WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    '42501', NULL, 'a user can''t clear their send log to be emailed again'
);
-- A user can still change their own preferences, and not someone else's.
UPDATE public.users SET notify_lead_days = 7 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';
RESET ROLE;
SELECT is(
    (SELECT notify_lead_days FROM public.users WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'),
    3::SMALLINT,
    'RLS keeps another user''s preferences unchanged'
);

-- ---------------------------------------------------------------------------
-- In-app notifications: added by the cron (service role), read and marked read by their owner
-- ---------------------------------------------------------------------------
INSERT INTO public.notifications (id, user_id, kind, ref_id, due_date, name, detail, amount)
VALUES
    ('11111111-aaaa-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'recurring_due', 'dddddddd-0000-0000-0000-000000000004', '2026-10-26', 'Phone', 'Bill', 65),
    ('22222222-bbbb-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'card_due', 'cccccccc-0000-0000-0000-000000000003', '2026-10-27', 'Visa', 'Credit card payment', 450);

SELECT throws_ok(
    $$INSERT INTO public.notifications (user_id, kind, ref_id, due_date, name, detail, amount)
      VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'recurring_due', 'dddddddd-0000-0000-0000-000000000004', '2026-10-26', 'Phone', 'Bill', 65)$$,
    '23505', NULL, 'the same reminder is added once per due date'
);

SELECT pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT results_eq(
    $$SELECT name FROM public.notifications$$,
    $$VALUES ('Phone'::TEXT)$$,
    'a user sees only their own notifications'
);
SELECT lives_ok(
    $$UPDATE public.notifications SET read_at = now() WHERE id = '11111111-aaaa-0000-0000-000000000001'$$,
    'a user can mark their notification read'
);
SELECT throws_ok(
    $$UPDATE public.notifications SET amount = 0 WHERE id = '11111111-aaaa-0000-0000-000000000001'$$,
    '42501', NULL, 'a user can''t change anything but read_at'
);
SELECT throws_ok(
    $$INSERT INTO public.notifications (user_id, kind, ref_id, due_date, name, detail, amount)
      VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'card_due', gen_random_uuid(), '2026-11-01', 'Fake', 'Bill', 1)$$,
    '42501', NULL, 'a user can''t add notifications'
);
SELECT throws_ok(
    $$DELETE FROM public.notifications WHERE id = '11111111-aaaa-0000-0000-000000000001'$$,
    '42501', NULL, 'a user can''t delete notifications'
);
UPDATE public.notifications SET read_at = now() WHERE id = '22222222-bbbb-0000-0000-000000000002';
UPDATE public.users SET changelog_seen_at = now() WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';
RESET ROLE;
SELECT ok(
    (SELECT read_at IS NOT NULL FROM public.notifications WHERE id = '11111111-aaaa-0000-0000-000000000001'),
    'the read time is saved'
);
SELECT ok(
    (SELECT read_at IS NULL FROM public.notifications WHERE id = '22222222-bbbb-0000-0000-000000000002'),
    'RLS keeps another user''s notification unread'
);
SELECT ok(
    (SELECT changelog_seen_at IS NOT NULL FROM public.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    'a user can record that they opened What''s new'
);

-- ---------------------------------------------------------------------------
-- Deleting the auth user removes everything they saved
-- ---------------------------------------------------------------------------
-- A legacy custom account type and an account using it: accounts.account_type_id is ON DELETE
-- RESTRICT, so this proves the cascade from auth.users still succeeds with both present.
INSERT INTO public.account_types (id, user_id, name, class, code)
VALUES ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'My custom type', 'asset', 'other');
INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance)
VALUES ('ffffffff-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'Custom', 'eeeeeeee-0000-0000-0000-000000000005', 100);
INSERT INTO public.account_transactions (account_id, user_id, amount, transaction_type, description)
VALUES ('ffffffff-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 100, 'deposit', 'Opening');
INSERT INTO public.recurring_expenses (user_id, name, amount, billing_period, next_due_date, category)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Phone', 65, '1:months', '2026-11-01', 'bill');
INSERT INTO public.contribution_rooms (user_id, plan, room) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'tfsa', 7000);

-- Deleting one account while the user exists still keeps its support snapshot.
INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance)
VALUES ('99999999-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'Old savings', 'eeeeeeee-0000-0000-0000-000000000005', 0);
DELETE FROM public.accounts WHERE id = '99999999-0000-0000-0000-000000000009';
SELECT is(
    (SELECT count(*)::INTEGER FROM public.deleted_accounts WHERE account_id = '99999999-0000-0000-0000-000000000009'),
    1,
    'deleting a single account keeps its snapshot'
);

SELECT lives_ok(
    $$DELETE FROM auth.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
    'deleting the login succeeds even with accounts'
);

SELECT is(
    (SELECT count(*)::INTEGER FROM (
        SELECT id FROM public.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT id FROM public.accounts WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT id FROM public.account_types WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT id FROM public.account_transactions WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT id FROM public.recurring_expenses WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT gen_random_uuid() FROM public.contribution_rooms WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT gen_random_uuid() FROM public.notification_sends WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT id FROM public.deleted_accounts WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
        UNION ALL SELECT id FROM public.notifications WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
    ) leftovers),
    0,
    'no row of the deleted user is left'
);

SELECT is(
    (SELECT count(*)::INTEGER FROM public.users WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002'),
    1,
    'other users are untouched'
);

-- ---------------------------------------------------------------------------
-- Resetting data keeps the login, profile and settings
-- ---------------------------------------------------------------------------
SELECT pg_temp.make_user('cccccccc-1111-0000-0000-000000000001');
SELECT pg_temp.make_user('dddddddd-2222-0000-0000-000000000002');
UPDATE public.users SET full_name = 'Reset Me', default_currency = 'EUR', notify_email = true
WHERE id = 'cccccccc-1111-0000-0000-000000000001';

CREATE OR REPLACE FUNCTION pg_temp.fill(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_account UUID := gen_random_uuid();
    v_allocation UUID := gen_random_uuid();
    v_category UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.accounts (id, user_id, name, account_type_id, current_balance)
    SELECT v_account, p_user, 'Chequing', t.id, 500 FROM public.account_types t WHERE t.code = 'chequing' AND t.user_id IS NULL LIMIT 1;
    INSERT INTO public.account_types (user_id, name, class, code) VALUES (p_user, 'Custom ' || p_user, 'asset', 'other');
    INSERT INTO public.account_transactions (account_id, user_id, amount, transaction_type, description)
    VALUES (v_account, p_user, 500, 'deposit', 'Pay');
    INSERT INTO public.account_promotions (account_id, user_id, title, promotion_type, reward_description, end_date)
    VALUES (v_account, p_user, 'Bonus', 'deposit_threshold', '$100', CURRENT_DATE + 30);
    INSERT INTO public.allocations (id, user_id, year, month) VALUES (v_allocation, p_user, 2026, 10);
    INSERT INTO public.allocation_categories (id, allocation_id, user_id, name) VALUES (v_category, v_allocation, p_user, 'Groceries');
    INSERT INTO public.transactions (user_id, category_id, name, amount, transaction_date) VALUES (p_user, v_category, 'Store', 40, '2026-10-02');
    INSERT INTO public.allocation_templates (user_id, name) VALUES (p_user, 'Usual month');
    INSERT INTO public.transaction_presets (user_id, name, description, amount, type, transaction_type)
    VALUES (p_user, 'Fare', 'Metro', 3.5, 'expense', 'withdrawal');
    INSERT INTO public.recurring_expenses (user_id, name, amount, billing_period, next_due_date, category)
    VALUES (p_user, 'Phone', 65, '1:months', '2026-11-01', 'bill');
    INSERT INTO public.contribution_rooms (user_id, plan, room) VALUES (p_user, 'tfsa', 7000);
    INSERT INTO public.notifications (user_id, kind, ref_id, due_date, name, detail, amount)
    VALUES (p_user, 'recurring_due', gen_random_uuid(), '2026-11-01', 'Phone', 'Bill', 65);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.saved_rows(p_user UUID) RETURNS INTEGER LANGUAGE sql AS $$
    SELECT (
        (SELECT count(*) FROM public.accounts WHERE user_id = p_user)
        + (SELECT count(*) FROM public.account_types WHERE user_id = p_user)
        + (SELECT count(*) FROM public.account_transactions WHERE user_id = p_user)
        + (SELECT count(*) FROM public.account_promotions WHERE user_id = p_user)
        + (SELECT count(*) FROM public.account_history WHERE user_id = p_user)
        + (SELECT count(*) FROM public.allocations WHERE user_id = p_user)
        + (SELECT count(*) FROM public.allocation_categories WHERE user_id = p_user)
        + (SELECT count(*) FROM public.transactions WHERE user_id = p_user)
        + (SELECT count(*) FROM public.allocation_templates WHERE user_id = p_user)
        + (SELECT count(*) FROM public.transaction_presets WHERE user_id = p_user)
        + (SELECT count(*) FROM public.recurring_expenses WHERE user_id = p_user)
        + (SELECT count(*) FROM public.contribution_rooms WHERE user_id = p_user)
        + (SELECT count(*) FROM public.notifications WHERE user_id = p_user)
        + (SELECT count(*) FROM public.deleted_accounts WHERE user_id = p_user)
    )::INTEGER;
$$;

SELECT pg_temp.fill('cccccccc-1111-0000-0000-000000000001');
SELECT pg_temp.fill('dddddddd-2222-0000-0000-000000000002');
-- One row in each of 12 tables (fill() writes no balance history).
SELECT is(pg_temp.saved_rows('cccccccc-1111-0000-0000-000000000001'), 12, 'the user has data to reset');

SELECT pg_temp.act_as(NULL);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.reset_my_data()$$, '42501', NULL, 'reset needs a signed-in user');
RESET ROLE;

SELECT pg_temp.act_as('cccccccc-1111-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.reset_my_data()$$, 'a signed-in user can reset their data');
RESET ROLE;

SELECT is(pg_temp.saved_rows('cccccccc-1111-0000-0000-000000000001'), 0, 'nothing the user saved is left, snapshots included');
SELECT results_eq(
    $$SELECT full_name, default_currency, notify_email FROM public.users WHERE id = 'cccccccc-1111-0000-0000-000000000001'$$,
    $$VALUES ('Reset Me'::TEXT, 'EUR'::TEXT, true)$$,
    'the profile and settings stay'
);
SELECT is((SELECT count(*)::INTEGER FROM auth.users WHERE id = 'cccccccc-1111-0000-0000-000000000001'), 1, 'the login stays');
SELECT is(pg_temp.saved_rows('dddddddd-2222-0000-0000-000000000002'), 12, 'another user''s data is untouched');

SELECT * FROM finish();
ROLLBACK;
