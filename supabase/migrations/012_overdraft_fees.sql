-- =============================================================================
-- Overdraft, NSF and over-limit fees (#150)
--
-- Accounts can record what their bank charges when the balance goes below zero or past the credit
-- limit. When a new ledger row moves the balance past that line, post_account_fee() posts the fee
-- as its own ledger row (type 'fee'), linked to the row that caused it; deleting that row reverses
-- and removes its fee. Overdraft interest is charged by the monthly interest job.
--
-- Every write path inserts the ledger row first and then moves the balance, so the fee hangs off
-- the balance update rather than the insert: the JS paths set the balance from a fresh read, which
-- would overwrite a fee posted at insert time. Additive and safe to re-run.
-- =============================================================================

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS overdraft_protection BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS overdraft_limit DECIMAL(15, 2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS overdraft_fee DECIMAL(15, 2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS nsf_fee DECIMAL(15, 2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS over_limit_fee DECIMAL(15, 2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS overdraft_interest_rate DECIMAL(5, 4);

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_fee_terms_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_fee_terms_check CHECK (
    COALESCE(overdraft_limit, 0) >= 0
    AND COALESCE(overdraft_fee, 0) >= 0
    AND COALESCE(nsf_fee, 0) >= 0
    AND COALESCE(over_limit_fee, 0) >= 0
    AND COALESCE(overdraft_interest_rate, 0) >= 0
);

ALTER TABLE public.account_transactions DROP CONSTRAINT IF EXISTS account_transactions_transaction_type_check;
ALTER TABLE public.account_transactions ADD CONSTRAINT account_transactions_transaction_type_check CHECK (
    transaction_type IN ('deposit', 'withdrawal', 'interest', 'payment', 'adjustment', 'contribution', 'transfer', 'refund', 'fee')
);

ALTER TABLE public.account_transactions
    ADD COLUMN IF NOT EXISTS fee_for_transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_account_transactions_fee_for ON public.account_transactions(fee_for_transaction_id);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('card_due', 'recurring_due', 'fee_due'));
ALTER TABLE public.notification_sends DROP CONSTRAINT IF EXISTS notification_sends_kind_check;
ALTER TABLE public.notification_sends
    ADD CONSTRAINT notification_sends_kind_check CHECK (kind IN ('card_due', 'recurring_due', 'fee_due', 'test'));

-- The fee follows the rule in src/lib/overdraft.ts (feeForBalance): an asset below zero pays the
-- overdraft fee while within its protected overdraft and the NSF fee past it (or with no
-- protection); a liability past its credit limit pays the over-limit fee. One fee per ledger row
-- that moves the balance out and lands past the line. Interest rows, fees and plain balance edits
-- (no matching ledger row) never charge one.
CREATE OR REPLACE FUNCTION public.post_account_fee() RETURNS TRIGGER AS $$
DECLARE
    v_class TEXT;
    v_delta DECIMAL(15, 2);
    v_fee DECIMAL(15, 2);
    v_label TEXT;
    v_cause RECORD;
BEGIN
    IF current_setting('pholio.posting_fee', true) = 'on' THEN RETURN NULL; END IF;

    v_delta := NEW.current_balance - OLD.current_balance;
    SELECT class INTO v_class FROM public.account_types WHERE id = NEW.account_type_id;

    IF v_class = 'liability' THEN
        IF v_delta <= 0 OR NEW.credit_limit IS NULL OR NEW.current_balance <= NEW.credit_limit THEN RETURN NULL; END IF;
        v_fee := NEW.over_limit_fee;
        v_label := 'Over-limit fee';
    ELSE
        IF v_delta >= 0 OR NEW.current_balance >= 0 THEN RETURN NULL; END IF;
        IF NEW.overdraft_protection AND NEW.current_balance >= -COALESCE(NEW.overdraft_limit, 0) THEN
            v_fee := NEW.overdraft_fee;
            v_label := 'Overdraft fee';
        ELSE
            v_fee := NEW.nsf_fee;
            v_label := 'NSF fee';
        END IF;
        v_fee := -v_fee;
    END IF;

    IF v_fee IS NULL OR v_fee = 0 THEN RETURN NULL; END IF;

    SELECT t.id, t.transaction_date INTO v_cause
    FROM public.account_transactions t
    WHERE t.account_id = NEW.id
      AND t.amount = v_delta
      AND t.transaction_type NOT IN ('fee', 'interest')
      AND t.created_at > now() - INTERVAL '10 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.account_transactions f WHERE f.fee_for_transaction_id = t.id AND f.charge_id IS NULL
      )
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF v_cause.id IS NULL THEN RETURN NULL; END IF;

    PERFORM set_config('pholio.posting_fee', 'on', true);
    INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, fee_for_transaction_id)
    VALUES (NEW.user_id, NEW.id, v_fee, 'fee', v_label, v_cause.transaction_date, v_cause.id);
    UPDATE public.accounts SET current_balance = current_balance + v_fee WHERE id = NEW.id;
    PERFORM set_config('pholio.posting_fee', 'off', true);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS post_account_fee_trigger ON public.accounts;
CREATE TRIGGER post_account_fee_trigger
    AFTER UPDATE OF current_balance ON public.accounts
    FOR EACH ROW WHEN (OLD.current_balance IS DISTINCT FROM NEW.current_balance)
    EXECUTE FUNCTION public.post_account_fee();

-- Deleting a ledger row reverses and removes its fee. Skipped inside cascades (a user being
-- deleted), where the accounts go too.
CREATE OR REPLACE FUNCTION public.reverse_account_fee() RETURNS TRIGGER AS $$
DECLARE
    v_fee RECORD;
BEGIN
    IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;

    FOR v_fee IN SELECT id, account_id, amount FROM public.account_transactions WHERE fee_for_transaction_id = OLD.id LOOP
        IF v_fee.account_id IS NOT NULL THEN
            UPDATE public.accounts SET current_balance = current_balance - v_fee.amount WHERE id = v_fee.account_id;
        END IF;
        DELETE FROM public.account_transactions WHERE id = v_fee.id;
    END LOOP;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS reverse_account_fee_trigger ON public.account_transactions;
CREATE TRIGGER reverse_account_fee_trigger
    BEFORE DELETE ON public.account_transactions
    FOR EACH ROW EXECUTE FUNCTION public.reverse_account_fee();

-- =============================================================================
-- Account charges: fees the user lists per account (monthly account fee, annual card fee, cash
-- advance fee, ...). Monthly and yearly charges post on next_charge_date through
-- post_due_account_charges(), run daily by the cron job; a monthly charge with waive_min_balance
-- is skipped when the account never closed a day below it during the month. Per-cash-advance
-- charges post with each ledger row marked is_cash_advance. Removing a charge retires it
-- (is_active = false) because posted fee rows point at it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.account_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'yearly', 'cash_advance')),
    -- Flat amount; for a cash advance, the minimum fee.
    amount DECIMAL(15, 2),
    -- Share of the advance (0.05 for 5%), cash advances only.
    rate DECIMAL(7, 6),
    -- Day of the month it posts on, so a charge on the 31st stays on month end.
    charge_day SMALLINT CHECK (charge_day BETWEEN 1 AND 31),
    next_charge_date DATE,
    waive_min_balance DECIMAL(15, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT account_charges_terms_check CHECK (
        COALESCE(amount, 0) >= 0
        AND COALESCE(rate, 0) >= 0
        AND COALESCE(amount, 0) + COALESCE(rate, 0) > 0
        AND (frequency = 'cash_advance' OR (next_charge_date IS NOT NULL AND charge_day IS NOT NULL AND amount IS NOT NULL))
        AND (frequency = 'cash_advance' OR rate IS NULL)
        AND (frequency = 'monthly' OR waive_min_balance IS NULL)
    )
);

ALTER TABLE public.account_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own account charges" ON public.account_charges;
CREATE POLICY "Users manage own account charges" ON public.account_charges FOR ALL USING ((select auth.uid()) = user_id);

DROP TRIGGER IF EXISTS account_charges_updated_at_trigger ON public.account_charges;
CREATE TRIGGER account_charges_updated_at_trigger BEFORE UPDATE ON public.account_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_account_charges_account ON public.account_charges(account_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_account_charges_due ON public.account_charges(next_charge_date) WHERE is_active;

GRANT ALL ON public.account_charges TO authenticated;

ALTER TABLE public.account_transactions
    ADD COLUMN IF NOT EXISTS charge_id UUID REFERENCES public.account_charges(id) ON DELETE SET NULL;
ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS is_cash_advance BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_account_transactions_charge ON public.account_transactions(charge_id);

-- The posting date after p_date: p_day of the next month (or year), or that month's last day when
-- it is shorter.
CREATE OR REPLACE FUNCTION public.next_charge_date(p_date DATE, p_day SMALLINT, p_frequency TEXT) RETURNS DATE AS $$
DECLARE
    v_month DATE := (date_trunc('month', p_date) + CASE WHEN p_frequency = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END)::DATE;
    v_last INTEGER := EXTRACT(DAY FROM (v_month + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;
BEGIN
    RETURN v_month + (LEAST(p_day, v_last) - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Lowest end-of-day balance from p_from to p_to, worked back from the current balance through the
-- ledger by transaction date. Balance edits with no ledger row are invisible to it.
CREATE OR REPLACE FUNCTION public.lowest_daily_balance(p_account_id UUID, p_from DATE, p_to DATE) RETURNS DECIMAL AS $$
    SELECT MIN(a.current_balance - COALESCE((
        SELECT SUM(t.amount) FROM public.account_transactions t
        WHERE t.account_id = p_account_id AND t.transaction_date > d::DATE
    ), 0))
    FROM public.accounts a, generate_series(p_from::TIMESTAMP, p_to::TIMESTAMP, INTERVAL '1 day') d
    WHERE a.id = p_account_id;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Posts every monthly and yearly charge due on or before p_today, catching up missed periods.
-- Returns how many fees were posted. Run by the cron job with the service role only.
CREATE OR REPLACE FUNCTION public.post_due_account_charges(p_today DATE DEFAULT CURRENT_DATE) RETURNS INTEGER AS $$
DECLARE
    v_charge RECORD;
    v_due DATE;
    v_amount DECIMAL(15, 2);
    v_posted INTEGER := 0;
    v_guard INTEGER;
BEGIN
    FOR v_charge IN
        SELECT c.*, a.user_id AS owner_id, t.class
        FROM public.account_charges c
        JOIN public.accounts a ON a.id = c.account_id AND a.is_active
        JOIN public.account_types t ON t.id = a.account_type_id
        WHERE c.is_active AND c.frequency IN ('monthly', 'yearly') AND c.next_charge_date <= p_today
        FOR UPDATE OF c
    LOOP
        v_due := v_charge.next_charge_date;
        v_guard := 0;
        WHILE v_due <= p_today AND v_guard < 36 LOOP
            v_guard := v_guard + 1;
            IF v_charge.waive_min_balance IS NULL
               OR v_charge.class = 'liability'
               OR public.lowest_daily_balance(v_charge.account_id, (v_due - INTERVAL '1 month')::DATE, v_due - 1) < v_charge.waive_min_balance
            THEN
                v_amount := CASE WHEN v_charge.class = 'liability' THEN v_charge.amount ELSE -v_charge.amount END;
                PERFORM set_config('pholio.posting_fee', 'on', true);
                INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, charge_id)
                VALUES (v_charge.owner_id, v_charge.account_id, v_amount, 'fee', v_charge.name, v_due, v_charge.id);
                UPDATE public.accounts SET current_balance = current_balance + v_amount WHERE id = v_charge.account_id;
                PERFORM set_config('pholio.posting_fee', 'off', true);
                v_posted := v_posted + 1;
            END IF;
            v_due := public.next_charge_date(v_due, v_charge.charge_day, v_charge.frequency);
        END LOOP;
        UPDATE public.account_charges SET next_charge_date = v_due WHERE id = v_charge.id;
    END LOOP;
    RETURN v_posted;
END;
$$ LANGUAGE plpgsql SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.post_due_account_charges(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_due_account_charges(DATE) TO service_role;

-- A ledger row marked is_cash_advance posts each active cash-advance charge on its account: the
-- greater of the flat amount and the rate times the advance. Hangs off the balance update for the
-- same reason as post_account_fee(); deleting the advance reverses its fees through
-- reverse_account_fee().
CREATE OR REPLACE FUNCTION public.post_cash_advance_fee() RETURNS TRIGGER AS $$
DECLARE
    v_delta DECIMAL(15, 2);
    v_class TEXT;
    v_cause RECORD;
    v_charge RECORD;
    v_fee DECIMAL(15, 2);
BEGIN
    IF current_setting('pholio.posting_fee', true) = 'on' THEN RETURN NULL; END IF;

    v_delta := NEW.current_balance - OLD.current_balance;
    SELECT class INTO v_class FROM public.account_types WHERE id = NEW.account_type_id;
    IF v_class IS DISTINCT FROM 'liability' OR v_delta <= 0 THEN RETURN NULL; END IF;

    SELECT t.id, t.transaction_date INTO v_cause
    FROM public.account_transactions t
    WHERE t.account_id = NEW.id
      AND t.amount = v_delta
      AND t.is_cash_advance
      AND t.created_at > now() - INTERVAL '10 minutes'
      AND NOT EXISTS (
          SELECT 1 FROM public.account_transactions f WHERE f.fee_for_transaction_id = t.id AND f.charge_id IS NOT NULL
      )
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF v_cause.id IS NULL THEN RETURN NULL; END IF;

    PERFORM set_config('pholio.posting_fee', 'on', true);
    FOR v_charge IN
        SELECT id, name, amount, rate FROM public.account_charges
        WHERE account_id = NEW.id AND is_active AND frequency = 'cash_advance'
    LOOP
        v_fee := GREATEST(COALESCE(v_charge.amount, 0), ROUND(v_delta * COALESCE(v_charge.rate, 0), 2));
        CONTINUE WHEN v_fee <= 0;
        INSERT INTO public.account_transactions (user_id, account_id, amount, transaction_type, description, transaction_date, fee_for_transaction_id, charge_id)
        VALUES (NEW.user_id, NEW.id, v_fee, 'fee', v_charge.name, v_cause.transaction_date, v_cause.id, v_charge.id);
        UPDATE public.accounts SET current_balance = current_balance + v_fee WHERE id = NEW.id;
    END LOOP;
    PERFORM set_config('pholio.posting_fee', 'off', true);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS post_cash_advance_fee_trigger ON public.accounts;
CREATE TRIGGER post_cash_advance_fee_trigger
    AFTER UPDATE OF current_balance ON public.accounts
    FOR EACH ROW WHEN (OLD.current_balance IS DISTINCT FROM NEW.current_balance)
    EXECUTE FUNCTION public.post_cash_advance_fee();
