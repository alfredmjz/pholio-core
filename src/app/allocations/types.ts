// Type definitions for the allocation feature

export type CategoryType = "regular" | "savings_goal" | "debt_payment";

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
	is_recurring: boolean;
	display_order: number;
	color?: string;
	icon?: string;
	notes?: string;
	// Unified transaction system fields
	category_type?: CategoryType;
	linked_account_id?: string | null;
	created_at: string;
	updated_at: string;
	// Computed fields from database function
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
	external_id?: string;
	notes?: string;
	// Unified transaction system linking
	linked_account_transaction_id?: string | null;
	created_at: string;
	updated_at: string;
	// Joined data
	category_name?: string;
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

export type ViewMode = "overview" | "transactions";

export interface MonthYear {
	year: number;
	month: number; // 1-12
}
