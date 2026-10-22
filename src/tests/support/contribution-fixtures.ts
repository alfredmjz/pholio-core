import type { AccountTypeCode, AccountWithType, ContributionPlan } from "@/app/accounts/types";
import type { ContributionSummary } from "@/lib/types/contribution";

/** Plain currency formatter so expected strings are easy to read in assertions. */
export const fmt = (amount: number) => `$${amount.toFixed(2)}`;

/**
 * A tracked TFSA pool as get_contribution_summaries() returns it: $25,000 room as of 1 January,
 * $5,000 contributed this year (of which $500 this month), $7,000 annual limit.
 */
export function makePool(overrides: Partial<ContributionSummary> = {}): ContributionSummary {
	return {
		pool_key: "tfsa",
		contribution_plan: "tfsa",
		tracks_room: true,
		account_ids: ["acc-1"],
		accounts: [{ account_id: "acc-1", month_contributions: 500, year_contributions: 5000 }],
		month_contributions: 500,
		month_withdrawals: 0,
		year_contributions: 5000,
		year_withdrawals: 0,
		lifetime_contributions: 5000,
		annual_limit: 7000,
		annual_limit_source: "cra",
		annual_remaining: 2000,
		room_as_of: "2026-01-01",
		room_entered: 25000,
		room_added: 0,
		room_used: 5000,
		room_remaining: 20000,
		lifetime_limit: null,
		room_needs_update: false,
		excess_amount: 0,
		tax_this_month: 0,
		tax_this_year: 0,
		tax_total: 0,
		taxed_months: 0,
		...overrides,
	};
}

interface AccountOptions {
	id?: string;
	accountClass?: "asset" | "liability";
	code?: AccountTypeCode | null;
	category?: string;
	balance?: number;
	creditLimit?: number | null;
	originalAmount?: number | null;
	plan?: ContributionPlan | null;
}

/** Minimal account for the validation helpers; only the fields they read are meaningful. */
export function makeAccount(options: AccountOptions = {}): AccountWithType {
	const accountClass = options.accountClass ?? "asset";
	return {
		id: options.id ?? "acc-1",
		user_id: "user-1",
		name: "Test account",
		account_type_id: "type-1",
		institution: null,
		account_number_last4: null,
		current_balance: options.balance ?? 0,
		currency: "CAD",
		credit_limit: options.creditLimit ?? null,
		original_amount: options.originalAmount ?? null,
		interest_rate: null,
		interest_type: null,
		loan_start_date: null,
		loan_term_months: null,
		payment_due_date: null,
		target_balance: null,
		track_contribution_room: false,
		contribution_plan: options.plan ?? null,
		contribution_room: null,
		contribution_room_as_of: null,
		annual_contribution_limit: null,
		notes: null,
		color: null,
		icon: null,
		display_order: 0,
		is_active: true,
		external_account_id: null,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		account_type: {
			id: "type-1",
			user_id: null,
			name: "Type",
			code: options.code === undefined ? (accountClass === "asset" ? "chequing" : "credit_card") : options.code,
			class: accountClass,
			category: options.category ?? (accountClass === "asset" ? "banking" : "credit"),
			is_tax_advantaged: false,
			icon: null,
			sort_order: 0,
			is_system: true,
			is_active: true,
			created_at: "2026-01-01T00:00:00Z",
		},
	} as AccountWithType;
}
