// Type definitions for the Balance Sheet feature (Unified Schema)

// ============================================================================
// Account Types (Customizable)
// ============================================================================

export type AccountClass = "asset" | "liability";

export type AccountCategory = "banking" | "investment" | "retirement" | "property" | "credit" | "debt" | "other";

export interface AccountType {
	id: string;
	user_id: string | null; // NULL = system default
	name: string;
	class: AccountClass;
	category: AccountCategory;
	is_tax_advantaged: boolean;
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
	| "refund";

export interface Account {
	id: string;
	user_id: string;
	name: string;
	account_type_id: string;
	institution: string | null;
	account_number_last4: string | null;
	current_balance: number;
	currency: string;
	credit_limit: number | null;
	original_amount: number | null;
	interest_rate: number | null;
	interest_type: InterestType | null;
	loan_start_date: string | null;
	loan_term_months: number | null;
	payment_due_date: number | null;
	target_balance: number | null;
	// Contribution room tracking (user choice)
	track_contribution_room: boolean;
	contribution_room: number | null;
	annual_contribution_limit: number | null;
	// Display
	notes: string | null;
	color: string | null;
	icon: string | null;
	percent_change?: number; // For assets (performance) or liabilities (change in debt)
	display_order: number;
	is_active: boolean;
	external_account_id: string | null;
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
	description: string | null;
	transaction_date: string;
	linked_allocation_transaction_id: string | null;
	created_at: string;
}

// ============================================================================
// Summary Types
// ============================================================================

export interface HistoricalDataPoint {
	date: string;
	value: number;
	hasActivity?: boolean;
}

export interface BalanceSheetSummary {
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
	account_number_last4?: string | null;
	current_balance: number;
	currency?: string;
	credit_limit?: number | null;
	original_amount?: number | null;
	interest_rate?: number | null;
	interest_type?: InterestType | null;
	loan_start_date?: string | null;
	loan_term_months?: number | null;
	payment_due_date?: number | null;
	target_balance?: number | null;
	track_contribution_room?: boolean;
	contribution_room?: number | null;
	annual_contribution_limit?: number | null;
	notes?: string | null;
	color?: string | null;
	icon?: string | null;
}

export interface UpdateAccountInput {
	name?: string;
	institution?: string | null;
	current_balance?: number;
	credit_limit?: number | null;
	interest_rate?: number | null;
	interest_type?: InterestType | null;
	loan_term_months?: number | null;
	payment_due_date?: number | null;
	target_balance?: number | null;
	track_contribution_room?: boolean;
	contribution_room?: number | null;
	annual_contribution_limit?: number | null;
	notes?: string | null;
	color?: string | null;
	icon?: string | null;
	display_order?: number;
	is_active?: boolean;
}

export interface RecordTransactionInput {
	account_id: string;
	amount: number;
	transaction_type: TransactionType;
	description?: string | null;
	transaction_date?: string;
}

export interface CreateAccountTypeInput {
	name: string;
	class: AccountClass;
	category: AccountCategory;
	is_tax_advantaged?: boolean;
	icon?: string | null;
}
