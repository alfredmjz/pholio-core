-- Migration: 008_user_timezone
-- Description: Add timezone preference to user profiles

-- Add timezone column (NULL = use system-detected timezone)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.users.timezone IS 'IANA timezone identifier (e.g. America/New_York). NULL means use system-detected timezone.';
