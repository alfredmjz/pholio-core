-- ============================================================================
-- pgTAP tests for the magic link send limits (migration 020).
-- Run against the local Supabase with `bun run test:db` from src/ (supabase test db).
--
-- Limits: 60 s between links for one email, 5 links per email per rolling hour, 20 links per IP
-- per rolling hour. now() is fixed inside the transaction, so sends are placed at exact offsets
-- from it and every expected wait below is worked out by hand in the comment above it.
-- ============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- Shorthand: record past sends for an email/IP at the given minutes before now().
CREATE OR REPLACE FUNCTION pg_temp.sent(p_email TEXT, p_ip TEXT, p_minutes_ago INTEGER[])
RETURNS VOID LANGUAGE sql AS $$
    INSERT INTO public.magic_link_sends (email_hash, ip_hash, created_at)
    SELECT p_email, p_ip, now() - make_interval(mins => m) FROM unnest(p_minutes_ago) AS m;
$$;

-- ---------------------------------------------------------------------------
-- First link, then the 60-second gap
-- ---------------------------------------------------------------------------
-- No history: allowed, and the next link waits the full 60 s.
SELECT results_eq(
    $$SELECT allowed, retry_after_seconds, reason FROM public.claim_magic_link_send('email-a', 'ip-a')$$,
    $$VALUES (true, 60, NULL::TEXT)$$,
    'first link is allowed and the next one unlocks in 60 s'
);

-- Asking again in the same instant: refused for 60 s.
SELECT results_eq(
    $$SELECT allowed, send_id, retry_after_seconds, reason FROM public.claim_magic_link_send('email-a', 'ip-a')$$,
    $$VALUES (false, NULL::BIGINT, 60, 'cooldown'::TEXT)$$,
    'a second link right away waits for the 60 s gap'
);

SELECT is((SELECT count(*)::INTEGER FROM public.magic_link_sends WHERE email_hash = 'email-a'), 1,
    'a refused request is not recorded');

-- Last link 2 minutes ago, 1 in the hour: the gap has passed.
SELECT pg_temp.sent('email-b', 'ip-b', ARRAY[2]);
SELECT is((SELECT allowed FROM public.claim_magic_link_send('email-b', 'ip-b')), true,
    'a link 2 minutes after the last one is allowed');

-- ---------------------------------------------------------------------------
-- 5 links per email per hour
-- ---------------------------------------------------------------------------
-- 5 links at 50, 40, 30, 20 and 10 minutes ago. The oldest leaves the hour in 10 min = 600 s.
SELECT pg_temp.sent('email-c', 'ip-c', ARRAY[50, 40, 30, 20, 10]);
SELECT results_eq(
    $$SELECT allowed, retry_after_seconds, reason FROM public.claim_magic_link_send('email-c', 'ip-c')$$,
    $$VALUES (false, 600, 'email_limit'::TEXT)$$,
    'the 6th link in an hour waits until the oldest is an hour old'
);

-- 4 links at 50, 40, 30 and 20 minutes ago: the 5th is allowed. That makes 5 in the hour, so the
-- next one waits until the link from 50 minutes ago leaves: 10 min = 600 s (longer than 60 s).
SELECT pg_temp.sent('email-d', 'ip-d', ARRAY[50, 40, 30, 20]);
SELECT results_eq(
    $$SELECT allowed, retry_after_seconds, reason FROM public.claim_magic_link_send('email-d', 'ip-d')$$,
    $$VALUES (true, 600, NULL::TEXT)$$,
    'the 5th link is allowed and reports the wait for a 6th'
);

-- 5 links all more than an hour ago (61-65 min): none count.
SELECT pg_temp.sent('email-e', 'ip-e', ARRAY[61, 62, 63, 64, 65]);
SELECT is((SELECT allowed FROM public.claim_magic_link_send('email-e', 'ip-e')), true,
    'links older than an hour no longer count');

-- ---------------------------------------------------------------------------
-- 20 links per IP per hour
-- ---------------------------------------------------------------------------
-- 20 different emails from one IP at 59, 56, ..., 2 minutes ago (every 3 minutes). The oldest
-- leaves the hour in 1 min = 60 s, so a 21st email from that IP waits 60 s.
SELECT pg_temp.sent('ip-email-' || i, 'ip-f', ARRAY[59 - (i - 1) * 3]) FROM generate_series(1, 20) AS i;
SELECT results_eq(
    $$SELECT allowed, retry_after_seconds, reason FROM public.claim_magic_link_send('email-new', 'ip-f')$$,
    $$VALUES (false, 60, 'ip_limit'::TEXT)$$,
    'a 21st link from one IP in an hour is refused'
);

-- The same new email from another IP is fine.
SELECT is((SELECT allowed FROM public.claim_magic_link_send('email-new', 'ip-g')), true,
    'the IP limit only applies to that IP');

-- ---------------------------------------------------------------------------
-- Release, clear and pruning
-- ---------------------------------------------------------------------------
-- Supabase failed to send: releasing the claim lets the user ask again at once.
SELECT public.release_magic_link_send(
    (SELECT send_id FROM public.claim_magic_link_send('email-h', 'ip-h'))
);
SELECT is((SELECT allowed FROM public.claim_magic_link_send('email-h', 'ip-h')), true,
    'a released send does not count');

-- Signing in clears the email's history: email-c (5 in the hour) can ask again.
SELECT public.clear_magic_link_sends('email-c');
SELECT is((SELECT allowed FROM public.claim_magic_link_send('email-c', 'ip-c')), true,
    'clearing after sign-in lifts the limit');

-- A row from 2 days ago is pruned by the next claim.
SELECT pg_temp.sent('email-old', 'ip-old', ARRAY[2 * 24 * 60]);
SELECT public.claim_magic_link_send('email-i', 'ip-i');
SELECT is((SELECT count(*)::INTEGER FROM public.magic_link_sends WHERE email_hash = 'email-old'), 0,
    'rows older than a day are pruned');

SELECT throws_ok(
    $$SELECT public.claim_magic_link_send('', 'ip-a')$$,
    'email and ip hashes are required',
    'an empty hash is rejected'
);

-- ---------------------------------------------------------------------------
-- The browser roles can't touch any of it
-- ---------------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.claim_magic_link_send(text, text)', 'EXECUTE'),
    'anon cannot claim sends');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_magic_link_send(text, text)', 'EXECUTE'),
    'signed-in users cannot claim sends');
SELECT ok(NOT has_function_privilege('anon', 'public.clear_magic_link_sends(text)', 'EXECUTE'),
    'anon cannot clear the history');
SELECT ok(NOT has_function_privilege('authenticated', 'public.clear_magic_link_sends(text)', 'EXECUTE'),
    'signed-in users cannot clear the history');
SELECT ok(NOT has_function_privilege('anon', 'public.release_magic_link_send(bigint)', 'EXECUTE'),
    'anon cannot release sends');
SELECT ok(NOT has_function_privilege('anon', 'public.magic_link_wait(text, text, timestamp with time zone)', 'EXECUTE'),
    'anon cannot read wait times');
SELECT ok(NOT has_table_privilege('anon', 'public.magic_link_sends', 'SELECT'), 'anon cannot read the table');
SELECT ok(NOT has_table_privilege('authenticated', 'public.magic_link_sends', 'INSERT'),
    'signed-in users cannot write the table');
SELECT ok(has_function_privilege('service_role', 'public.claim_magic_link_send(text, text)', 'EXECUTE'),
    'the server (service_role) can claim sends');

SELECT * FROM finish();
ROLLBACK;
