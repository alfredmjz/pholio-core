import type { AccountWithType, RegisteredPlan } from "@/app/accounts/types";
import type { AllocationContributions } from "@/lib/types/contribution";

export const VIRTUAL_UNCATEGORIZED_ID = "00000000-0000-0000-0000-000000000000";

export interface Allocation {
	id: string;
	user_id: string;
	year: number;
	month: number;
	expected_income: number;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface AllocationCategory {
	id: string;
	allocation_id: string;
	user_id: string;
	name: string;
	budget_cap: number;
	/** System-managed recurring contribution; effective budget = budget_cap + recurring_budget_cap. */
	recurring_budget_cap?: number;
	is_recurring: boolean;
	display_order: number;
	color?: string;
	icon?: string;
	notes?: string;

	/** Registered plan whose contribution room this budget is shown against (not in the summary RPC). */
	contribution_plan?: RegisteredPlan | null;
	created_at: string;
	updated_at: string;

	actual_spend?: number;
	remaining?: number;
	utilization_percentage?: number;
	transaction_count?: number;
}

export interface Transaction {
	id: string;
	user_id: string;
	category_id?: string;
	name: string;
	amount: number;
	transaction_date: string;
	source: string;
	notes?: string;

	linked_account_transaction_id?: string | null;
	linked_account_transaction?: {
		id: string;
		account_id: string | null;
		amount: number;
	} | null;
	linked_account_transactions?: Array<{ id: string; account_id: string | null }> | null;
	account_id?: string; // Derived for easier UI consumption
	created_at: string;
	updated_at: string;

	category_name?: string;

	recurring_expense_id?: string | null;
	/** The bill due date a recurring payment settles; null means its transaction date. */
	covers_due_date?: string | null;
	is_recurring_stopped?: boolean;
}

export interface AllocationTemplate {
	id: string;
	user_id: string;
	name: string;
	description?: string;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface TemplateCategory {
	id: string;
	template_id: string;
	user_id: string;
	name: string;
	budget_cap: number;
	is_recurring: boolean;
	display_order: number;
	color?: string;
	icon?: string;
	notes?: string;
	created_at: string;
}

export interface AllocationSummary {
	allocation: Allocation;
	categories: AllocationCategory[];
	summary: {
		total_budget_caps: number;
		total_actual_spend: number;
		unallocated_funds: number;
		overall_utilization: number;
	};
}

/** Everything the Allocations page refetches, returned by one request. */
export interface AllocationPageData {
	summary: AllocationSummary | null;
	transactions: Transaction[];
	accounts: AccountWithType[];
	contributions: AllocationContributions;
}

export type ViewMode = "overview" | "transactions";

export interface MonthYear {
	year: number;
	month: number; // 1-12
}

export type IncomeVerificationStatus = "verified" | "tracking" | "not_set";

export interface IncomeDrift {
	detected: boolean;
	direction: "increase" | "decrease";
	suggestedAmount: number;
	monthsObserved: number;
}

export interface IncomeVerificationResult {
	status: IncomeVerificationStatus;
	consecutiveMatches: number;
	drift: IncomeDrift | null;
}
