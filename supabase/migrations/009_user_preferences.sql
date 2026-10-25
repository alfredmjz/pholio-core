-- =============================================================================
-- User preferences, payment reminders and the notification bell
--
-- Settings gains a default currency, a number and date format, and payment reminders for credit
-- card due dates and upcoming recurring items, shown in the app, emailed, both or neither. They
-- are per-user preferences like timezone, so they live on public.users, whose existing RLS already
-- limits each row to its owner. changelog_seen_at is when the user last opened "What's new"; NULL
-- means never, and the app then counts from when they signed up.
--
-- notifications holds the in-app reminders the daily cron creates, one per item and due date.
-- Users read their own rows and can only change read_at; only the service role adds them. The
-- cron prunes rows older than 60 days.
--
-- notification_sends records every reminder emailed, one row per item and due date, so the daily
-- cron never emails the same item twice; test emails from Settings are logged too, to cap them at
-- five a day. RLS is on with no policies and all grants revoked: only
-- the service-role client the cron uses can read or write it. The cron prunes rows older than
-- 60 days; nothing references them.
--
-- Also guards the account snapshot trigger from 002_finance.sql so deleting a whole account
-- succeeds, and adds reset_my_data() for Settings (end of file). Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'CAD';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-CA';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notify_lead_days SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notify_in_app BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS changelog_seen_at TIMESTAMPTZ;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_default_currency_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_default_currency_check CHECK (default_currency IN ('AUD', 'CAD', 'EUR', 'GBP', 'JPY', 'USD'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_locale_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_locale_check CHECK (locale IN ('en-CA', 'en-GB', 'en-US', 'fr-CA', 'fr-FR'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_notify_lead_days_check;
ALTER TABLE public.users
    ADD CONSTRAINT users_notify_lead_days_check CHECK (notify_lead_days BETWEEN 1 AND 14);

CREATE TABLE IF NOT EXISTS public.notification_sends (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('card_due', 'recurring_due', 'test')),
    ref_id UUID NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notification_sends_once UNIQUE (user_id, kind, ref_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_notification_sends_created ON public.notification_sends (created_at);

ALTER TABLE public.notification_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_sends FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_sends TO service_role;

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('card_due', 'recurring_due')),
    ref_id UUID NOT NULL,
    due_date DATE NOT NULL,
    name TEXT NOT NULL,
    detail TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    CONSTRAINT notifications_once UNIQUE (user_id, kind, ref_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read" ON public.notifications
    FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Deleting a whole account from Settings
--
-- Settings deletes the auth user, which cascades to every table. The account snapshot trigger in
-- 002_finance.sql would then insert into deleted_accounts for a user that no longer exists and
-- fail the whole delete. When the owner is gone, nothing of theirs is kept, so the snapshot is
-- skipped. Deleting a single account still keeps its snapshot.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_account_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_type_name TEXT;
    v_class TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
        RETURN OLD;
    END IF;

    SELECT name, class INTO v_type_name, v_class
    FROM public.account_types
    WHERE id = OLD.account_type_id;

    INSERT INTO public.deleted_accounts (user_id, account_id, name, account_type_name, class, data)
    VALUES (OLD.user_id, OLD.id, OLD.name, v_type_name, v_class, to_jsonb(OLD));

    RETURN OLD;
END;
$$;

-- -----------------------------------------------------------------------------
-- Resetting data from Settings
--
-- Deletes everything the signed-in user has saved, in one transaction, and keeps their login,
-- profile and settings. SECURITY DEFINER because some tables (notifications, the deleted-account
-- snapshots) give users no delete rights; every statement is limited to auth.uid(). Promotions go
-- first so deleting ledger rows doesn't recalculate them, and the snapshots last, after deleting
-- accounts has written them.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_my_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID := auth.uid();
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to reset your data' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.account_promotions WHERE user_id = v_user;
    DELETE FROM public.account_transactions WHERE user_id = v_user;
    DELETE FROM public.recurring_recorded_occurrences WHERE user_id = v_user;
    DELETE FROM public.transactions WHERE user_id = v_user;
    DELETE FROM public.allocation_categories WHERE user_id = v_user;
    DELETE FROM public.allocations WHERE user_id = v_user;
    DELETE FROM public.allocation_templates WHERE user_id = v_user;
    DELETE FROM public.transaction_presets WHERE user_id = v_user;
    DELETE FROM public.recurring_expenses WHERE user_id = v_user;
    DELETE FROM public.contribution_rooms WHERE user_id = v_user;
    DELETE FROM public.notifications WHERE user_id = v_user;
    -- Test emails stay logged, so a reset can't lift the daily cap.
    DELETE FROM public.notification_sends WHERE user_id = v_user AND kind <> 'test';
    DELETE FROM public.account_history WHERE user_id = v_user;
    DELETE FROM public.accounts WHERE user_id = v_user;
    DELETE FROM public.account_types WHERE user_id = v_user AND is_system = false;
    DELETE FROM public.deleted_accounts WHERE user_id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;
