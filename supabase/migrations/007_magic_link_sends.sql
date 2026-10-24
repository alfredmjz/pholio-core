-- =============================================================================
-- Magic link send limits
--
-- Every sign-in email the app asks Supabase to send is recorded here, so the server can limit
-- resends no matter what the browser sends:
--   - 60 seconds between links for the same email (Supabase's own per-user minimum),
--   - at most 5 links per email in any rolling hour,
--   - at most 20 links per IP address in any rolling hour.
--
-- Only SHA-256 hashes of the normalized email and IP are stored. The table has RLS on and no
-- policies, and the functions are executable only by service_role, so the browser (anon or a
-- signed-in user) can neither read the history nor add to it or clear it. The server action
-- calls them with the admin client.
--
-- Rows are short-lived request logs that nothing references; claims prune rows older than a day.
-- Additive and safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.magic_link_sends (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_sends_email ON public.magic_link_sends (email_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_magic_link_sends_ip ON public.magic_link_sends (ip_hash, created_at);

ALTER TABLE public.magic_link_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.magic_link_sends FROM PUBLIC, anon, authenticated;

-- How long until the next send is allowed for this email and IP, and which limit is the one
-- holding it back. No row means a send is allowed now.
CREATE OR REPLACE FUNCTION public.magic_link_wait(p_email_hash TEXT, p_ip_hash TEXT, p_now TIMESTAMPTZ)
RETURNS TABLE (wait_seconds INTEGER, reason TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH email_sends AS (
        SELECT created_at FROM public.magic_link_sends
        WHERE email_hash = p_email_hash AND created_at > p_now - INTERVAL '1 hour'
    ),
    ip_sends AS (
        SELECT created_at FROM public.magic_link_sends
        WHERE ip_hash = p_ip_hash AND created_at > p_now - INTERVAL '1 hour'
    ),
    waits AS (
        -- 60 seconds after the latest link for this email.
        SELECT 'cooldown' AS reason, (SELECT max(created_at) FROM email_sends) + INTERVAL '60 seconds' AS until
        UNION ALL
        -- With 5 links in the hour, the next one waits until the 5th most recent leaves the window.
        SELECT 'email_limit', (SELECT created_at FROM email_sends ORDER BY created_at DESC OFFSET 4 LIMIT 1) + INTERVAL '1 hour'
        UNION ALL
        -- Same for 20 links from one IP.
        SELECT 'ip_limit', (SELECT created_at FROM ip_sends ORDER BY created_at DESC OFFSET 19 LIMIT 1) + INTERVAL '1 hour'
    )
    SELECT CEIL(EXTRACT(EPOCH FROM (until - p_now)))::INTEGER, reason
    FROM waits
    WHERE until > p_now
    ORDER BY until DESC
    LIMIT 1;
$$;

-- Checks the limits and records the send in one step. Locks per email and per IP (always in that
-- order) so parallel requests can't both pass the count. Returns the id to release if Supabase
-- then fails to send, and how long until the next send is allowed.
CREATE OR REPLACE FUNCTION public.claim_magic_link_send(p_email_hash TEXT, p_ip_hash TEXT)
RETURNS TABLE (allowed BOOLEAN, send_id BIGINT, retry_after_seconds INTEGER, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_wait INTEGER;
    v_reason TEXT;
    v_id BIGINT;
BEGIN
    IF COALESCE(p_email_hash, '') = '' OR COALESCE(p_ip_hash, '') = '' THEN
        RAISE EXCEPTION 'email and ip hashes are required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('magic_link_email:' || p_email_hash, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('magic_link_ip:' || p_ip_hash, 0));

    DELETE FROM public.magic_link_sends WHERE created_at < v_now - INTERVAL '1 day';

    SELECT w.wait_seconds, w.reason INTO v_wait, v_reason
    FROM public.magic_link_wait(p_email_hash, p_ip_hash, v_now) w;

    IF FOUND THEN
        RETURN QUERY SELECT false, NULL::BIGINT, v_wait, v_reason;
        RETURN;
    END IF;

    INSERT INTO public.magic_link_sends (email_hash, ip_hash, created_at)
    VALUES (p_email_hash, p_ip_hash, v_now)
    RETURNING id INTO v_id;

    SELECT w.wait_seconds INTO v_wait
    FROM public.magic_link_wait(p_email_hash, p_ip_hash, v_now) w;

    RETURN QUERY SELECT true, v_id, COALESCE(v_wait, 0), NULL::TEXT;
END;
$$;

-- Supabase didn't send the email, so the attempt doesn't count against the user.
CREATE OR REPLACE FUNCTION public.release_magic_link_send(p_send_id BIGINT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.magic_link_sends WHERE id = p_send_id;
$$;

-- The user signed in, so links already sent stop counting (signing out and back in starts fresh).
CREATE OR REPLACE FUNCTION public.clear_magic_link_sends(p_email_hash TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.magic_link_sends WHERE email_hash = p_email_hash;
$$;

REVOKE ALL ON FUNCTION public.magic_link_wait(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_magic_link_send(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_magic_link_send(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_magic_link_sends(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.magic_link_wait(TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_magic_link_send(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_magic_link_send(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_magic_link_sends(TEXT) TO service_role;
