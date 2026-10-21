-- ============================================================================
-- MIGRATION: 013_investment_contribution_tracking.sql
-- Investment deposit and contribution room tracking (issue #121).
--
--   * `accounts.contribution_plan` is the stable registered-plan code (TFSA, RRSP, FHSA,
--     RESP or other). Behaviour must branch on this code, never on the account name.
--   * CRA contribution room belongs to the person, not to an account, so room for the
--     registered plans lives in `contribution_rooms` (one row per user and plan) and every
--     tracked account of that plan counts toward it. "Other" and legacy plan-less accounts
--     keep their own room in the existing account columns.
--   * `allocation_categories.contribution_plan` links a budget category to a plan so the
--     Allocations page can show the budget against the remaining room.
--   * `contribution_limits` is a read-only reference table of CRA limits per plan and year.
--   * `get_contribution_summaries()` derives deposits, annual progress and remaining room
--     per plan from `account_transactions` on read, so the figures never drift from the
--     ledger (edits and deletes are reflected automatically).
--
-- ADDITIVE AND IDEMPOTENT: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Account columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS contribution_plan TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS contribution_room_as_of DATE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_contribution_plan'
          AND conrelid = 'public.accounts'::regclass
    ) THEN
        ALTER TABLE public.accounts
            ADD CONSTRAINT valid_contribution_plan CHECK (
                contribution_plan IS NULL OR contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp', 'other')
            );
    END IF;
END $$;

-- Registered-plan accounts take their room from contribution_rooms, so only "other" and
-- plan-less accounts still need a room figure on the account itself. Relaxing a CHECK
-- never invalidates existing rows.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS valid_contribution_tracking;
ALTER TABLE public.accounts
    ADD CONSTRAINT valid_contribution_tracking CHECK (
        track_contribution_room = false
        OR contribution_room IS NOT NULL
        OR contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
    );

COMMENT ON COLUMN public.accounts.contribution_plan IS 'Registered plan code used for contribution rules: tfsa, rrsp, fhsa, resp or other';
COMMENT ON COLUMN public.accounts.contribution_room_as_of IS 'Date contribution_room applies to (only for "other" and plan-less accounts)';
COMMENT ON COLUMN public.accounts.contribution_room IS 'Available contribution room on contribution_room_as_of (only for "other" and plan-less accounts)';
COMMENT ON COLUMN public.accounts.annual_contribution_limit IS 'Annual limit override for the year of contribution_room_as_of (only for "other" and plan-less accounts)';

-- ---------------------------------------------------------------------------
-- 2. Contribution room per user and registered plan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contribution_rooms (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')),
    room DECIMAL(15, 2),
    room_as_of DATE,
    annual_limit DECIMAL(15, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, plan)
);

ALTER TABLE public.contribution_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own contribution rooms" ON public.contribution_rooms;
CREATE POLICY "Users manage own contribution rooms" ON public.contribution_rooms
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT ALL ON public.contribution_rooms TO authenticated;

DROP TRIGGER IF EXISTS contribution_rooms_updated_at_trigger ON public.contribution_rooms;
CREATE TRIGGER contribution_rooms_updated_at_trigger BEFORE UPDATE ON public.contribution_rooms
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.contribution_rooms IS 'CRA contribution room per user and registered plan, shared by every account of that plan';
COMMENT ON COLUMN public.contribution_rooms.room IS 'Available room on room_as_of, copied from CRA My Account';
COMMENT ON COLUMN public.contribution_rooms.annual_limit IS 'User override of the annual limit for the year of room_as_of (blank = CRA default)';

-- ---------------------------------------------------------------------------
-- 3. Budget categories linked to a plan
-- ---------------------------------------------------------------------------
ALTER TABLE public.allocation_categories ADD COLUMN IF NOT EXISTS contribution_plan TEXT;
ALTER TABLE public.template_categories ADD COLUMN IF NOT EXISTS contribution_plan TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_category_contribution_plan'
          AND conrelid = 'public.allocation_categories'::regclass
    ) THEN
        ALTER TABLE public.allocation_categories
            ADD CONSTRAINT valid_category_contribution_plan CHECK (
                contribution_plan IS NULL OR contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
            );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_template_category_contribution_plan'
          AND conrelid = 'public.template_categories'::regclass
    ) THEN
        ALTER TABLE public.template_categories
            ADD CONSTRAINT valid_template_category_contribution_plan CHECK (
                contribution_plan IS NULL OR contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
            );
    END IF;
END $$;

COMMENT ON COLUMN public.allocation_categories.contribution_plan IS 'Registered plan whose contribution room this budget is measured against (budget is shown, only actual contributions use room)';

-- ---------------------------------------------------------------------------
-- 4. CRA limits reference table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contribution_limits (
    plan TEXT NOT NULL CHECK (plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')),
    year INTEGER NOT NULL,
    annual_limit DECIMAL(15, 2),
    lifetime_limit DECIMAL(15, 2),
    PRIMARY KEY (plan, year)
);

-- Reference data: every signed-in user can read it, nobody can write it through the API.
ALTER TABLE public.contribution_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Signed-in users read contribution limits" ON public.contribution_limits;
CREATE POLICY "Signed-in users read contribution limits" ON public.contribution_limits
    FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.contribution_limits TO authenticated;

-- Published CRA figures. DO UPDATE keeps re-runs idempotent and lets a corrected figure land.
INSERT INTO public.contribution_limits (plan, year, annual_limit, lifetime_limit) VALUES
    ('tfsa', 2009, 5000, NULL),
    ('tfsa', 2010, 5000, NULL),
    ('tfsa', 2011, 5000, NULL),
    ('tfsa', 2012, 5000, NULL),
    ('tfsa', 2013, 5500, NULL),
    ('tfsa', 2014, 5500, NULL),
    ('tfsa', 2015, 10000, NULL),
    ('tfsa', 2016, 5500, NULL),
    ('tfsa', 2017, 5500, NULL),
    ('tfsa', 2018, 5500, NULL),
    ('tfsa', 2019, 6000, NULL),
    ('tfsa', 2020, 6000, NULL),
    ('tfsa', 2021, 6000, NULL),
    ('tfsa', 2022, 6000, NULL),
    ('tfsa', 2023, 6500, NULL),
    ('tfsa', 2024, 7000, NULL),
    ('tfsa', 2025, 7000, NULL),
    ('tfsa', 2026, 7000, NULL),
    ('rrsp', 2020, 27230, NULL),
    ('rrsp', 2021, 27830, NULL),
    ('rrsp', 2022, 29210, NULL),
    ('rrsp', 2023, 30780, NULL),
    ('rrsp', 2024, 31560, NULL),
    ('rrsp', 2025, 32490, NULL),
    ('rrsp', 2026, 33810, NULL),
    ('fhsa', 2023, 8000, 40000),
    ('resp', 2007, NULL, 50000)
ON CONFLICT (plan, year) DO UPDATE
    SET annual_limit = EXCLUDED.annual_limit,
        lifetime_limit = EXCLUDED.lifetime_limit;

-- Latest published limit for a plan on or before the given year (a year CRA has not
-- announced yet reuses the most recent figure).
CREATE OR REPLACE FUNCTION public.contribution_limit_for(p_plan TEXT, p_year INTEGER)
RETURNS TABLE (annual_limit DECIMAL(15, 2), lifetime_limit DECIMAL(15, 2))
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT l.annual_limit, l.lifetime_limit
    FROM public.contribution_limits l
    WHERE l.plan = p_plan AND l.year <= p_year
    ORDER BY l.year DESC
    LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 5. Contribution summaries per plan
-- ---------------------------------------------------------------------------
-- One row per "pool" of the calling user, as at the last day of the given month:
--   * registered plans (TFSA, RRSP, FHSA, RESP): every tracked account of that plan plus
--     the room in contribution_rooms; pool_key = the plan code. A plan with a room row but
--     no accounts still gets a row so a linked budget category can show it.
--   * "other", plan-less tracked accounts and untracked investment accounts: one pool per
--     account; pool_key = the account id.
--
--   contribution = positive deposit/contribution/transfer row
--   withdrawal   = negative withdrawal/transfer row
--   A transfer between two accounts of the same pool or the same registered plan is a
--   qualifying transfer and counts as neither; an FHSA -> RRSP transfer does not use RRSP
--   room. Interest, refunds and adjustments are growth or corrections and never count.
--
--   annual_remaining = annual_limit - contributions from 1 January to period end
--   room_remaining   = room
--                      - contributions since room_as_of
--                      + (TFSA) withdrawals since then made in earlier calendar years
--                        (CRA adds them back on 1 January of the following year)
--                      + (TFSA) the dollar limit of every year after the as-of year
--   RRSP and FHSA room depends on income / Schedule 15, so it is not rolled forward;
--   room_needs_update flags when the user should copy a fresh figure from CRA.
DROP FUNCTION IF EXISTS public.get_contribution_summaries(INTEGER, INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.get_contribution_summaries(p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
    pool_key TEXT,
    contribution_plan TEXT,
    tracks_room BOOLEAN,
    account_ids UUID[],
    accounts JSONB,
    month_contributions DECIMAL(15, 2),
    month_withdrawals DECIMAL(15, 2),
    year_contributions DECIMAL(15, 2),
    year_withdrawals DECIMAL(15, 2),
    lifetime_contributions DECIMAL(15, 2),
    annual_limit DECIMAL(15, 2),
    annual_limit_source TEXT,
    annual_remaining DECIMAL(15, 2),
    room_as_of DATE,
    room_entered DECIMAL(15, 2),
    room_added DECIMAL(15, 2),
    room_used DECIMAL(15, 2),
    room_remaining DECIMAL(15, 2),
    lifetime_limit DECIMAL(15, 2),
    room_needs_update BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH bounds AS (
        SELECT
            make_date(p_year, p_month, 1) AS month_start,
            (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS period_end,
            make_date(p_year, 1, 1) AS year_start
    ),
    members AS (
        SELECT
            a.id AS account_id,
            a.created_at::date AS created_on,
            a.contribution_plan AS plan,
            COALESCE(a.track_contribution_room, false) AS tracks_room,
            (COALESCE(a.track_contribution_room, false)
                AND a.contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')) AS registered,
            CASE
                WHEN COALESCE(a.track_contribution_room, false)
                     AND a.contribution_plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
                    THEN a.contribution_plan
                ELSE a.id::text
            END AS pool_key,
            a.contribution_room,
            a.contribution_room_as_of,
            a.annual_contribution_limit
        FROM public.accounts a
        JOIN public.account_types t ON t.id = a.account_type_id
        WHERE a.user_id = auth.uid()
          AND a.is_active = true
          AND (
              t.code = 'investment'
              OR t.category IN ('investment', 'retirement')
              OR COALESCE(a.track_contribution_room, false)
          )
    ),
    pools AS (
        SELECT
            m.pool_key,
            MIN(m.plan) AS plan,
            bool_or(m.tracks_room) AS tracks_room,
            bool_or(m.registered) AS registered,
            array_agg(m.account_id ORDER BY m.account_id) AS account_ids,
            MIN(m.created_on) AS first_created,
            -- Account-level room settings: only used by single-account pools.
            MAX(m.contribution_room) AS account_room,
            MAX(m.contribution_room_as_of) AS account_room_as_of,
            MAX(m.annual_contribution_limit) AS account_annual_limit
        FROM members m
        GROUP BY m.pool_key
        UNION ALL
        SELECT r.plan, r.plan, true, true, ARRAY[]::uuid[], NULL::date, NULL, NULL, NULL
        FROM public.contribution_rooms r
        WHERE r.user_id = auth.uid()
          AND NOT EXISTS (SELECT 1 FROM members m WHERE m.pool_key = r.plan)
    ),
    settings AS (
        SELECT
            p.*,
            CASE WHEN p.registered THEN r.room ELSE p.account_room END AS room,
            CASE WHEN p.registered THEN r.room_as_of ELSE p.account_room_as_of END AS room_as_of_set,
            CASE WHEN p.registered THEN r.annual_limit ELSE p.account_annual_limit END AS annual_override
        FROM pools p
        LEFT JOIN public.contribution_rooms r
            ON p.registered AND r.user_id = auth.uid() AND r.plan = p.pool_key
    ),
    flows AS (
        SELECT m.pool_key, m.account_id, tx.transaction_date, tx.amount
        FROM public.account_transactions tx
        JOIN members m ON m.account_id = tx.account_id
        LEFT JOIN public.account_transactions peer ON peer.id = tx.linked_transfer_transaction_id
        LEFT JOIN members peer_member ON peer_member.account_id = peer.account_id
        LEFT JOIN public.accounts peer_account ON peer_account.id = peer.account_id
        WHERE tx.transaction_type IN ('deposit', 'contribution', 'withdrawal', 'transfer')
          AND NOT (
              tx.transaction_type = 'transfer'
              AND (
                  COALESCE(peer_member.pool_key = m.pool_key, false)
                  OR COALESCE(m.registered AND peer_account.contribution_plan = m.plan, false)
                  OR COALESCE(
                      m.registered AND m.plan = 'rrsp' AND peer_account.contribution_plan = 'fhsa' AND tx.amount > 0,
                      false
                  )
              )
          )
    ),
    account_totals AS (
        SELECT
            m.pool_key,
            m.account_id,
            COALESCE(SUM(f.amount) FILTER (
                WHERE f.amount > 0 AND f.transaction_date BETWEEN b.month_start AND b.period_end), 0) AS month_in,
            COALESCE(SUM(f.amount) FILTER (
                WHERE f.amount > 0 AND f.transaction_date BETWEEN b.year_start AND b.period_end), 0) AS year_in
        FROM members m
        CROSS JOIN bounds b
        LEFT JOIN flows f ON f.account_id = m.account_id
        GROUP BY m.pool_key, m.account_id
    ),
    totals AS (
        SELECT
            s.pool_key,
            COALESCE(s.room_as_of_set, s.first_created, b.year_start) AS room_date,
            COALESCE(SUM(f.amount) FILTER (
                WHERE f.amount > 0 AND f.transaction_date BETWEEN b.month_start AND b.period_end), 0) AS month_in,
            COALESCE(SUM(-f.amount) FILTER (
                WHERE f.amount < 0 AND f.transaction_date BETWEEN b.month_start AND b.period_end), 0) AS month_out,
            COALESCE(SUM(f.amount) FILTER (
                WHERE f.amount > 0 AND f.transaction_date BETWEEN b.year_start AND b.period_end), 0) AS year_in,
            COALESCE(SUM(-f.amount) FILTER (
                WHERE f.amount < 0 AND f.transaction_date BETWEEN b.year_start AND b.period_end), 0) AS year_out,
            COALESCE(SUM(f.amount) FILTER (
                WHERE f.amount > 0 AND f.transaction_date <= b.period_end), 0) AS lifetime_in,
            COALESCE(SUM(f.amount) FILTER (
                WHERE f.amount > 0
                  AND f.transaction_date BETWEEN COALESCE(s.room_as_of_set, s.first_created, b.year_start) AND b.period_end
            ), 0) AS since_in,
            COALESCE(SUM(-f.amount) FILTER (
                WHERE f.amount < 0
                  AND f.transaction_date >= COALESCE(s.room_as_of_set, s.first_created, b.year_start)
                  AND f.transaction_date < b.year_start
            ), 0) AS restored_out
        FROM settings s
        CROSS JOIN bounds b
        LEFT JOIN flows f ON f.pool_key = s.pool_key
        GROUP BY s.pool_key, s.room_as_of_set, s.first_created, b.year_start
    ),
    resolved AS (
        SELECT
            s.pool_key, s.plan, s.tracks_room, s.registered, s.account_ids, s.room, s.room_as_of_set, s.annual_override,
            t.room_date, t.month_in, t.month_out, t.year_in, t.year_out, t.lifetime_in, t.since_in,
            cra.annual_limit AS cra_annual_limit,
            cra.lifetime_limit AS cra_lifetime_limit,
            -- The user's own annual figure applies to the year it was copied for.
            (s.annual_override IS NOT NULL
                AND (s.room_as_of_set IS NULL OR EXTRACT(YEAR FROM s.room_as_of_set)::int = p_year)) AS use_override,
            CASE
                WHEN s.plan = 'tfsa' THEN (
                    SELECT COALESCE(SUM(l.annual_limit), 0)
                    FROM generate_series(EXTRACT(YEAR FROM t.room_date)::int + 1, p_year) AS y(year)
                    CROSS JOIN LATERAL public.contribution_limit_for('tfsa', y.year) l
                ) + t.restored_out
                ELSE 0
            END AS added
        FROM settings s
        JOIN totals t ON t.pool_key = s.pool_key
        LEFT JOIN LATERAL public.contribution_limit_for(s.plan, p_year) cra
            ON s.plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
    )
    SELECT
        r.pool_key,
        r.plan AS contribution_plan,
        r.tracks_room,
        r.account_ids,
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'account_id', at.account_id,
                        'month_contributions', at.month_in,
                        'year_contributions', at.year_in
                    )
                    ORDER BY at.account_id
                ),
                '[]'::jsonb
            )
            FROM account_totals at
            WHERE at.pool_key = r.pool_key
        ) AS accounts,
        r.month_in::DECIMAL(15, 2) AS month_contributions,
        r.month_out::DECIMAL(15, 2) AS month_withdrawals,
        r.year_in::DECIMAL(15, 2) AS year_contributions,
        r.year_out::DECIMAL(15, 2) AS year_withdrawals,
        r.lifetime_in::DECIMAL(15, 2) AS lifetime_contributions,
        CASE
            WHEN NOT r.tracks_room THEN NULL
            WHEN r.use_override THEN r.annual_override
            ELSE r.cra_annual_limit
        END AS annual_limit,
        CASE
            WHEN NOT r.tracks_room THEN NULL
            WHEN r.use_override THEN 'account'
            WHEN r.cra_annual_limit IS NOT NULL THEN 'cra'
            ELSE NULL
        END AS annual_limit_source,
        CASE
            WHEN NOT r.tracks_room THEN NULL
            WHEN r.use_override THEN (r.annual_override - r.year_in)::DECIMAL(15, 2)
            WHEN r.cra_annual_limit IS NOT NULL THEN (r.cra_annual_limit - r.year_in)::DECIMAL(15, 2)
            ELSE NULL
        END AS annual_remaining,
        CASE WHEN r.tracks_room THEN r.room_date END AS room_as_of,
        CASE WHEN r.tracks_room THEN r.room END AS room_entered,
        CASE WHEN r.tracks_room AND r.room IS NOT NULL THEN r.added::DECIMAL(15, 2) END AS room_added,
        CASE WHEN r.tracks_room AND r.room IS NOT NULL THEN r.since_in::DECIMAL(15, 2) END AS room_used,
        CASE
            WHEN r.tracks_room AND r.room IS NOT NULL THEN (r.room + r.added - r.since_in)::DECIMAL(15, 2)
        END AS room_remaining,
        CASE WHEN r.tracks_room THEN r.cra_lifetime_limit END AS lifetime_limit,
        (r.tracks_room AND r.registered AND r.plan IN ('rrsp', 'fhsa') AND r.room IS NOT NULL
            AND EXTRACT(YEAR FROM r.room_date)::int < p_year) AS room_needs_update
    FROM resolved r;
$$;

GRANT EXECUTE ON FUNCTION public.contribution_limit_for(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contribution_summaries(INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
