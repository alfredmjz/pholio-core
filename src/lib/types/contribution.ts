// Investment contribution tracking types (issue #121).
// Every figure is derived in PostgreSQL by get_contribution_summaries(); the client only renders it.

import type { ContributionPlan, RegisteredPlan } from "@/app/balancesheet/types";

/** One account's part of a pool, for "this account" figures. */
export interface ContributionAccountShare {
	account_id: string;
	month_contributions: number;
	year_contributions: number;
}

/**
 * Deposits, annual progress and remaining room for one pool, as at the last day of the
 * requested month. A registered plan (TFSA, RRSP, FHSA, RESP) is one pool shared by every
 * tracked account of that plan; any other investment account is a pool of its own.
 */
export interface ContributionSummary {
	/** The plan code for registered plans, otherwise the account id. */
	pool_key: string;
	contribution_plan: ContributionPlan | null;
	tracks_room: boolean;
	account_ids: string[];
	accounts: ContributionAccountShare[];
	month_contributions: number;
	month_withdrawals: number;
	year_contributions: number;
	year_withdrawals: number;
	/** Every contribution recorded in Pholio up to the period end. */
	lifetime_contributions: number;
	/** Null when the pool does not track room or no annual limit applies (e.g. RESP). */
	annual_limit: number | null;
	/** "account" = the user's own figure for that year, "cra" = the published CRA limit. */
	annual_limit_source: "account" | "cra" | null;
	annual_remaining: number | null;
	room_as_of: string | null;
	/** Room the user copied from CRA for `room_as_of`. */
	room_entered: number | null;
	/** Room CRA adds after `room_as_of` (TFSA new-year limits and restored withdrawals). */
	room_added: number | null;
	/** Contributions since `room_as_of`. */
	room_used: number | null;
	room_remaining: number | null;
	/** Statutory lifetime cap (FHSA $40,000, RESP $50,000), when one exists. */
	lifetime_limit: number | null;
	/** RRSP/FHSA room cannot be rolled forward; the user should copy a fresh figure from CRA. */
	room_needs_update: boolean;
	/** Amount over the total room right now (null when room is not tracked). */
	excess_amount: number | null;
	/** Estimated CRA over-contribution tax (1% a month on the excess) for the requested month. */
	tax_this_month: number | null;
	/** Estimated tax for the requested month's calendar year, up to that month. */
	tax_this_year: number | null;
	/** Estimated tax since the room date. */
	tax_total: number | null;
	/** Months in which an excess was taxed. */
	taxed_months: number | null;
}

/** The pool an account belongs to, plus that account's own share. */
export interface AccountContribution {
	pool: ContributionSummary;
	share: ContributionAccountShare | null;
}

/** Room settings for a registered plan, as stored in `contribution_rooms`. */
export interface ContributionRoomSetting {
	plan: RegisteredPlan;
	room: number | null;
	room_as_of: string | null;
	annual_limit: number | null;
}

/** What the Allocations page needs: every pool and which category is linked to which plan. */
export interface AllocationContributions {
	pools: ContributionSummary[];
	/** Category id → registered plan, for the categories of the requested month. */
	categoryPlans: Record<string, RegisteredPlan>;
}
