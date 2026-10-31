// Type definitions for the Accounts feature (Unified Schema)

// ============================================================================
// Account Types (Customizable)
// ============================================================================

export type AccountClass = "asset" | "liability";

/**
 * Final category set for issue #99. `property` and `retirement` were removed when the
 * catalogue was reduced to seven core account types plus "Other".
 */
export type AccountCategory = "banking" | "investment" | "credit" | "debt" | "other";

/**
 * Stable machine key for an account type. Never branch on `AccountType.name` - the name
 * is only a display label. `null` marks a legacy or user-created type retired by
 * migration 006 that the owner has not re-selected yet.
 */
export type AccountTypeCode =
	| "chequing"
	| "savings"
	| "investment"
	| "credit_card"
	| "line_of_credit"
	| "mortgage"
	| "loan"
	| "other";

/**
 * Registered-plan code that decides which contribution rules apply to an account
 * (stored in `accounts.contribution_plan`). "other" uses only the limits the user enters.
 */
export type ContributionPlan = "tfsa" | "rrsp" | "fhsa" | "resp" | "other";

/**
 * CRA registered plans. Their room belongs to the person, so it is stored once per plan
 * (`contribution_rooms`) and shared by every tracked account of that plan.
 */
export type RegisteredPlan = Exclude<ContributionPlan, "other">;

/**
 * Per-account field configuration, used by the fully-customisable "Other" account type.
 */
export interface AccountFieldConfig {
	showTargetGoal?: boolean;
	showCreditLimit?: boolean;
	showOriginalAmount?: boolean;
	showInterestRate?: boolean;
	showLoanTerm?: boolean;
	showDueDate?: boolean;
	showContributionRoom?: boolean;
	showOverdraft?: boolean;
	showOverLimitFee?: boolean;
}

export interface AccountType {
	id: string;
	user_id: string | null; // NULL = system default
	name: string;
	code?: AccountTypeCode | null;
	class: AccountClass;
	category: AccountCategory;
	icon: string | null;
	sort_order: number;
	is_system: boolean;
	is_active: boolean;
	created_at: string;
}

// ============================================================================
// Accounts
// ============================================================================

export type InterestType = "simple" | "compound" | "none";

export type TransactionType =
	| "deposit"
	| "withdrawal"
	| "interest"
	| "payment"
	| "adjustment"
	| "contribution"
	| "transfer"
	| "refund"
	| "fee";

export interface Account {
	id: string;
	user_id: string;
	name: string;
	account_type_id: string;
	institution: string | null;
	current_balance: number;
	currency: string;
	credit_limit: number | null;
	original_amount: number | null;
	interest_rate: number | null;
	interest_type: InterestType | null;
	loan_start_date: string | null;
	loan_term_months: number | null;
	payment_due_date: number | null;
	/** Day of the month a card's statement closes; null = 21 days before the due date. */
	statement_day?: number | null;
	target_balance: number | null;
	// Field visibility chosen by the owner (only meaningful for the "Other" type)
	field_visibility?: AccountFieldConfig | null;
	// Contribution room tracking (user choice)
	track_contribution_room: boolean;
	contribution_plan: ContributionPlan | null;
	contribution_room: number | null;
	contribution_room_as_of: string | null;
	annual_contribution_limit: number | null;
	// Bank fees (#150): posted by post_account_fee() when a payment goes past the line
	overdraft_protection?: boolean;
	overdraft_limit?: number | null;
	overdraft_fee?: number | null;
	nsf_fee?: number | null;
	over_limit_fee?: number | null;
	overdraft_interest_rate?: number | null;
	// Display
	notes: string | null;
	color: string | null;
	icon: string | null;
	percent_change?: number; // For assets (performance) or liabilities (change in debt)
	display_order: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

// Account with joined type info (for UI display)
export interface AccountWithType extends Account {
	account_type: AccountType;
}

// ============================================================================
// Account History & Transactions
// ============================================================================

export interface AccountHistory {
	id: string;
	account_id: string;
	user_id: string;
	balance: number;
	recorded_at: string;
	source: "auto" | "manual" | "import";
	created_at: string;
}

export interface AccountTransaction {
	id: string;
	account_id: string;
	user_id: string;
	amount: number;
	transaction_type: TransactionType;
	description: string;
	transaction_date: string;
	linked_allocation_transaction_id: string | null;
	linked_transfer_transaction_id?: string | null;
	created_at: string;
	/** The account charge that posted this fee row. */
	charge_id?: string | null;
	is_cash_advance?: boolean;
	/** The budget row this ledger row belongs to, for linking to Allocations. */
	budget_link?: AccountTransactionBudgetLink | null;
	/** For a transfer leg, the account on the other side (null when it was deleted). */
	transfer_account?: { id: string; label: string } | null;
}

export interface AccountTransactionBudgetLink {
	id: string;
	transaction_date: string;
	category_name: string | null;
}

// ============================================================================
// Account Promotions & Welcome Bonuses
// ============================================================================

export type PromotionType = "spend_threshold" | "deposit_threshold" | "maintaining_balance";

export interface AccountPromotion {
	id: string;
	account_id: string;
	user_id: string;
	title: string;
	promotion_type: PromotionType;
	target_amount: number;
	current_amount: number;
	reward_description: string;
	start_date: string;
	end_date: string;
	is_completed: boolean;
	notes?: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreatePromotionInput {
	account_id: string;
	title: string;
	promotion_type: PromotionType;
	target_amount: number;
	reward_description: string;
	start_date?: string;
	end_date: string;
	notes?: string | null;
}

export interface UpdatePromotionInput {
	title?: string;
	promotion_type?: PromotionType;
	target_amount?: number;
	current_amount?: number;
	reward_description?: string;
	start_date?: string;
	end_date?: string;
	is_completed?: boolean;
	notes?: string | null;
}

// ============================================================================
// Account charges (monthly / yearly fees, cash advance fees)
// ============================================================================

export type ChargeFrequency = "monthly" | "yearly" | "cash_advance";

export interface AccountCharge {
	id: string;
	account_id: string;
	user_id: string;
	name: string;
	frequency: ChargeFrequency;
	/** Flat amount; for a cash advance, the minimum fee. */
	amount: number | null;
	/** Share of a cash advance as a fraction (0.05 for 5%). */
	rate: number | null;
	charge_day: number | null;
	/** YYYY-MM-DD, monthly and yearly only. */
	next_charge_date: string | null;
	/** Monthly only: no fee for a month the balance never closed a day below this. */
	waive_min_balance: number | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface AccountChargeInput {
	name: string;
	frequency: ChargeFrequency;
	amount: number | null;
	rate: number | null;
	next_charge_date: string | null;
	waive_min_balance: number | null;
}

// ============================================================================
// Account type migration (issue #99 cleanup)
// ============================================================================
// TODO(#99-cleanup): remove these types, the migration actions, the banner/dialog and the
// legacy category bridge in field-visibility.ts once no account_types row has code IS NULL.

export interface AccountTypeMigrationUpdate {
	accountId: string;
	typeId: string;
	fieldVisibility?: AccountFieldConfig | null;
}

export interface AccountTypeMigrationItem {
	account: AccountWithType;
	/** Category-derived suggestion only - the owner always confirms the final choice. */
	suggestedCode: AccountTypeCode;
}

// ============================================================================
// Summary Types
// ============================================================================

export interface HistoricalDataPoint {
	date: string;
	value: number;
	hasActivity?: boolean;
}

export interface AccountsSummary {
	totalAssets: number;
	totalLiabilities: number;
	netWorth: number;
	previousTotalAssets?: number;
	previousTotalLiabilities?: number;
	previousNetWorth?: number;
	historicalAssets?: HistoricalDataPoint[];
	historicalLiabilities?: HistoricalDataPoint[];
	assetAccounts: AccountWithType[];
	liabilityAccounts: AccountWithType[];
}

// ============================================================================
// Input Types (for API calls)
// ============================================================================

export interface CreateAccountInput {
	name: string;
	account_type_id: string;
	institution?: string | null;
	current_balance: number;
	currency?: string;
	credit_limit?: number | null;
	original_amount?: number | null;
	interest_rate?: number | null;
	interest_type?: InterestType | null;
	loan_start_date?: string | null;
	field_visibility?: AccountFieldConfig | null;
	loan_term_months?: number | null;
	payment_due_date?: number | null;
	statement_day?: number | null;
	target_balance?: number | null;
	track_contribution_room?: boolean;
	contribution_plan?: ContributionPlan | null;
	contribution_room?: number | null;
	contribution_room_as_of?: string | null;
	annual_contribution_limit?: number | null;
	overdraft_protection?: boolean;
	overdraft_limit?: number | null;
	overdraft_fee?: number | null;
	nsf_fee?: number | null;
	over_limit_fee?: number | null;
	overdraft_interest_rate?: number | null;
	notes?: string | null;
	color?: string | null;
	icon?: string | null;
}

export interface UpdateAccountInput {
	name?: string;
	institution?: string | null;
	current_balance?: number;
	credit_limit?: number | null;
	original_amount?: number | null;
	interest_rate?: number | null;
	interest_type?: InterestType | null;
	loan_term_months?: number | null;
	payment_due_date?: number | null;
	statement_day?: number | null;
	target_balance?: number | null;
	track_contribution_room?: boolean;
	contribution_plan?: ContributionPlan | null;
	contribution_room?: number | null;
	contribution_room_as_of?: string | null;
	annual_contribution_limit?: number | null;
	overdraft_protection?: boolean;
	overdraft_limit?: number | null;
	overdraft_fee?: number | null;
	nsf_fee?: number | null;
	over_limit_fee?: number | null;
	overdraft_interest_rate?: number | null;
	notes?: string | null;
	color?: string | null;
	icon?: string | null;
	field_visibility?: AccountFieldConfig | null;
	display_order?: number;
	is_active?: boolean;
}
