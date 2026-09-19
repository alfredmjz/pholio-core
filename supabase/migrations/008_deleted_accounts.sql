-- ============================================================================
-- MIGRATION: 008_deleted_accounts.sql
-- Hard-delete accounts while preserving their transaction history and keeping a
-- support-only snapshot for manual recovery.
--
--   * `deleted_accounts` stores a full snapshot of every deleted account (support
--     only; no user-facing RLS grant — users cannot read or restore it themselves).
--   * `account_transactions.account_id` becomes nullable with ON DELETE SET NULL so
--     ledger rows survive account deletion (they keep `account_id = NULL`, which the
--     UI surfaces as a "Deleted account" indicator).
--   * A BEFORE DELETE trigger snapshots the account. This avoids relying on a
--     PostgREST-callable function, so no schema-cache reload is needed.
--
-- ADDITIVE AND IDEMPOTENT: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Support-only snapshot of deleted accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deleted_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type_name VARCHAR(100),
    class TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support-only table. RLS is enabled with NO policies, so anon/authenticated get no
-- access (Supabase grants default privileges on new public tables). The archive trigger
-- is SECURITY DEFINER and runs as the owner, so it can still write the snapshot.
ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Preserve account_transactions when an account is deleted
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_transactions ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.account_transactions DROP CONSTRAINT IF EXISTS account_transactions_account_id_fkey;
ALTER TABLE public.account_transactions
    ADD CONSTRAINT account_transactions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Snapshot the account before it is deleted (runs inside Postgres, not PostgREST)
-- ---------------------------------------------------------------------------
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
    SELECT name, class INTO v_type_name, v_class
    FROM public.account_types
    WHERE id = OLD.account_type_id;

    INSERT INTO public.deleted_accounts (user_id, account_id, name, account_type_name, class, data)
    VALUES (OLD.user_id, OLD.id, OLD.name, v_type_name, v_class, to_jsonb(OLD));

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS accounts_archive_on_delete ON public.accounts;
CREATE TRIGGER accounts_archive_on_delete
BEFORE DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.archive_account_on_delete();

-- Remove the earlier RPC-based approach if it was ever applied.
DROP FUNCTION IF EXISTS public.archive_and_delete_account(UUID);

-- Ask PostgREST to pick up the new table immediately (harmless if it already has).
NOTIFY pgrst, 'reload schema';
