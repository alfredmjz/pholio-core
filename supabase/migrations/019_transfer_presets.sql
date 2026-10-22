-- =============================================================================
-- Transfer presets
--
-- A preset can now be a transfer between two of the user's accounts, so "From a preset" works
-- for transfers too. For a transfer, account_id is where the money leaves and to_account_id is
-- where it lands; category_id stays NULL (transfers don't touch the budget).
--
-- Additive and safe to re-run. No CHECK that both accounts are set: deleting an account sets
-- these references to NULL, and such a CHECK would make that delete fail. The app treats a
-- transfer preset with a missing account as unusable instead.
-- =============================================================================

ALTER TABLE public.transaction_presets
    ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transaction_presets DROP CONSTRAINT IF EXISTS transaction_presets_type_check;
ALTER TABLE public.transaction_presets
    ADD CONSTRAINT transaction_presets_type_check CHECK (type IN ('income', 'expense', 'transfer'));
