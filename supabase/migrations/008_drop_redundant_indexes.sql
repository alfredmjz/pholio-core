-- Indexes that duplicate a UNIQUE constraint's index, or that idx_transactions_user_date supersedes.
-- Delete this file once production has run it.

DROP INDEX IF EXISTS public.users_email_idx;
DROP INDEX IF EXISTS public.idx_recurring_recorded_occurrences_user;
DROP INDEX IF EXISTS public.transactions_date_idx;
