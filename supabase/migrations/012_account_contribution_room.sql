-- Restore the contribution room columns on accounts.
--
-- The migration consolidation in #113 dropped these columns from the accounts table,
-- but AddAccountDialog, EditAccountDialog and AssetPerformance still read and write them.
-- Databases created from the consolidated migrations (local, CI) therefore reject every
-- new account. Databases migrated before #113 already have the columns, so every
-- statement here is a no-op there.

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS track_contribution_room BOOLEAN DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS contribution_room DECIMAL(15, 2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS annual_contribution_limit DECIMAL(15, 2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_contribution_tracking'
          AND conrelid = 'public.accounts'::regclass
    ) THEN
        ALTER TABLE public.accounts
            ADD CONSTRAINT valid_contribution_tracking CHECK (
                track_contribution_room = false OR contribution_room IS NOT NULL
            );
    END IF;
END $$;

COMMENT ON COLUMN public.accounts.track_contribution_room IS 'User choice: enable contribution room tracking for this account';
COMMENT ON COLUMN public.accounts.contribution_room IS 'Remaining contribution room (for tax-advantaged accounts)';
COMMENT ON COLUMN public.accounts.annual_contribution_limit IS 'Annual contribution limit (for reference)';
