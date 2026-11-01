-- =============================================================================
-- RRSP annual limit follows the deduction limit
--
-- CRA's RRSP dollar maximum (33,810 for 2026) caps the room a year of income can earn; it is
-- not what a person may contribute. When the user has entered this year's RRSP deduction limit
-- from their Notice of Assessment, the annual contribution limit is that figure
-- (annual_limit_source = 'deduction_limit'). Without one, the CRA maximum still shows.
-- Replaces get_contribution_summaries from 006; safe to re-run.
-- =============================================================================

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
    room_needs_update BOOLEAN,
    excess_amount DECIMAL(15, 2),
    tax_this_month DECIMAL(15, 2),
    tax_this_year DECIMAL(15, 2),
    tax_total DECIMAL(15, 2),
    taxed_months INTEGER
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
            b.period_end,
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
            COALESCE(
                jsonb_agg(jsonb_build_object('d', f.transaction_date, 'a', f.amount)) FILTER (WHERE f.amount IS NOT NULL),
                '[]'::jsonb
            ) AS flow_list
        FROM settings s
        CROSS JOIN bounds b
        LEFT JOIN flows f ON f.pool_key = s.pool_key
        GROUP BY s.pool_key, s.room_as_of_set, s.first_created, b.year_start, b.period_end
    ),
    resolved AS (
        SELECT
            s.pool_key, s.plan, s.tracks_room, s.registered, s.account_ids, s.room, s.room_as_of_set, s.annual_override,
            t.room_date, t.month_in, t.month_out, t.year_in, t.year_out, t.lifetime_in,
            cra.annual_limit AS cra_annual_limit,
            cra.lifetime_limit AS cra_lifetime_limit,
            -- A registered plan's own annual figure (legacy rows) applies to the year it was
            -- copied for; an "Other" account's annual limit applies every year.
            (s.annual_override IS NOT NULL
                AND (NOT s.registered OR s.room_as_of_set IS NULL
                     OR EXTRACT(YEAR FROM s.room_as_of_set)::int = p_year)) AS use_override,
            -- An RRSP deduction limit entered for this year is the most the user can contribute.
            (s.registered AND s.plan = 'rrsp' AND s.room IS NOT NULL
                AND EXTRACT(YEAR FROM t.room_date)::int = p_year) AS use_rrsp_room,
            w.room_added AS walk_added,
            w.room_used AS walk_used,
            w.room_remaining AS walk_remaining,
            w.excess_amount,
            w.tax_this_month,
            w.tax_this_year,
            w.tax_total,
            w.taxed_months
        FROM settings s
        JOIN totals t ON t.pool_key = s.pool_key
        LEFT JOIN LATERAL public.contribution_limit_for(s.plan, p_year) cra
            ON s.plan IN ('tfsa', 'rrsp', 'fhsa', 'resp')
        LEFT JOIN LATERAL public.contribution_room_walk(s.plan, s.room, t.room_date, t.period_end, t.flow_list) w
            ON s.tracks_room AND s.room IS NOT NULL
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
            WHEN r.use_rrsp_room THEN r.room
            ELSE r.cra_annual_limit
        END AS annual_limit,
        CASE
            WHEN NOT r.tracks_room THEN NULL
            WHEN r.use_override THEN 'account'
            WHEN r.use_rrsp_room THEN 'deduction_limit'
            WHEN r.cra_annual_limit IS NOT NULL THEN 'cra'
            ELSE NULL
        END AS annual_limit_source,
        CASE
            WHEN NOT r.tracks_room THEN NULL
            WHEN r.use_override THEN (r.annual_override - r.year_in)::DECIMAL(15, 2)
            WHEN r.use_rrsp_room THEN (r.room - r.year_in)::DECIMAL(15, 2)
            WHEN r.cra_annual_limit IS NOT NULL THEN (r.cra_annual_limit - r.year_in)::DECIMAL(15, 2)
            ELSE NULL
        END AS annual_remaining,
        CASE WHEN r.tracks_room THEN r.room_date END AS room_as_of,
        CASE WHEN r.tracks_room THEN r.room END AS room_entered,
        r.walk_added AS room_added,
        r.walk_used AS room_used,
        r.walk_remaining AS room_remaining,
        CASE WHEN r.tracks_room THEN r.cra_lifetime_limit END AS lifetime_limit,
        (r.tracks_room AND r.registered AND r.plan IN ('rrsp', 'fhsa') AND r.room IS NOT NULL
            AND EXTRACT(YEAR FROM r.room_date)::int < p_year) AS room_needs_update,
        r.excess_amount,
        r.tax_this_month,
        r.tax_this_year,
        r.tax_total,
        r.taxed_months
    FROM resolved r;
$$;

GRANT EXECUTE ON FUNCTION public.get_contribution_summaries(INTEGER, INTEGER) TO authenticated;
