-- Allow 'refund' rows in the account ledger.
--
-- The transaction dialog offers Refund as an income type and createUnifiedTransaction /
-- recordTransaction write transaction_type = 'refund' into account_transactions,
-- but the CHECK constraint from 003 never listed it (transaction_presets already did).
-- Every refund tagged to an account was therefore rejected.
--
-- The constraint is the auto-named one from the CREATE TABLE in 003. Dropping and
-- re-adding it in one ALTER TABLE keeps the swap atomic, and the statement is safe to
-- re-run: the second run drops the widened constraint and adds the same one back.

ALTER TABLE public.account_transactions
    DROP CONSTRAINT IF EXISTS account_transactions_transaction_type_check,
    ADD CONSTRAINT account_transactions_transaction_type_check CHECK (
        transaction_type IN ('deposit', 'withdrawal', 'interest', 'payment', 'adjustment', 'contribution', 'transfer', 'refund')
    );
