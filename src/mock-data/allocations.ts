import { AllocationSummary, Transaction } from "@/app/allocations/types";
import { TransactionType } from "@/app/allocations/components/TransactionTypeIcon";
import type { AllocationCategory } from "@/app/allocations/types";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const sampleCategories: AllocationCategory[] = [
	{
		id: "cat-housing",
		allocation_id: "sample-allocation-id",
		user_id: "user-1",
		name: "Housing",
		budget_cap: 2000,
		is_recurring: true,
		display_order: 1,
		color: "blue",
		icon: "Home",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		actual_spend: 2000,
		remaining: 0,
		utilization_percentage: 100,
		transaction_count: 1,
	},
	{
		id: "cat-food",
		allocation_id: "sample-allocation-id",
		user_id: "user-1",
		name: "Food & Dining",
		budget_cap: 800,
		is_recurring: false,
		display_order: 2,
		color: "green",
		icon: "Utensils",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		actual_spend: 650,
		remaining: 150,
		utilization_percentage: 81.25,
		transaction_count: 12,
	},
	{
		id: "cat-transport",
		allocation_id: "sample-allocation-id",
		user_id: "user-1",
		name: "Transportation",
		budget_cap: 400,
		is_recurring: false,
		display_order: 3,
		color: "orange",
		icon: "Car",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		actual_spend: 150,
		remaining: 250,
		utilization_percentage: 37.5,
		transaction_count: 4,
	},
	{
		id: "cat-utilities",
		allocation_id: "sample-allocation-id",
		user_id: "user-1",
		name: "Utilities",
		budget_cap: 300,
		is_recurring: true,
		display_order: 4,
		color: "cyan",
		icon: "Zap",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		actual_spend: 280,
		remaining: 20,
		utilization_percentage: 93.3,
		transaction_count: 3,
	},
	{
		id: "cat-entertainment",
		allocation_id: "sample-allocation-id",
		user_id: "user-1",
		name: "Entertainment",
		budget_cap: 200,
		is_recurring: false,
		display_order: 5,
		color: "purple",
		icon: "Film",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		actual_spend: 250,
		remaining: -50,
		utilization_percentage: 125,
		transaction_count: 5,
	},
];

export const sampleAllocationSummary: AllocationSummary = {
	allocation: {
		id: "sample-allocation-id",
		user_id: "user-1",
		year: CURRENT_YEAR,
		month: CURRENT_MONTH,
		expected_income: 5000,
		notes: "Sample Budget",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	},
	categories: sampleCategories,
	summary: {
		total_budget_caps: 3700,
		total_actual_spend: 3330,
		unallocated_funds: 1300, // 5000 - 3700
		overall_utilization: 90,
	},
};

const createTx = (
	id: string,
	name: string,
	amount: number,
	day: number,
	categoryId?: string,
	type: TransactionType = "one_time"
): Transaction => {
	const categoryName = categoryId ? sampleCategories.find((c) => c.id === categoryId)?.name : undefined;

	return {
		id,
		user_id: "user-1",
		category_id: categoryId,
		category_name: categoryName,
		name,
		amount,
		transaction_date: new Date(CURRENT_YEAR, CURRENT_MONTH - 1, day).toISOString(),
		source: "manual",
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};
};

export const sampleTransactions: Transaction[] = [
	createTx("tx-1", "Rent Payment", 2000, 1, "cat-housing", "recurring"),
	createTx("tx-2", "Electric Bill", 150, 5, "cat-utilities", "recurring"),
	createTx("tx-3", "Water Bill", 50, 12, "cat-utilities", "recurring"),
	createTx("tx-4", "Internet Subscription", 80, 15, "cat-utilities", "subscription"),
	createTx("tx-5", "Grocery Store", 150, 2, "cat-food"),
	createTx("tx-6", "Restaurant Dinner", 85, 4, "cat-food"),
	createTx("tx-7", "Coffee Shop", 15, 6, "cat-food"),
	createTx("tx-8", "Grocery Run", 200, 10, "cat-food"),
	createTx("tx-9", "Gas Station", 60, 3, "cat-transport"),
	createTx("tx-10", "Uber Ride", 25, 8, "cat-transport"),
	createTx("tx-11", "Car Insurance", 100, 15, "cat-transport"),
	createTx("tx-12", "Netflix Subscription", 15, 1, "cat-entertainment", "subscription"),
	createTx("tx-13", "Spotify", 10, 1, "cat-entertainment", "subscription"),
	createTx("tx-14", "Movie Tickets", 40, 20, "cat-entertainment"),
	createTx("tx-15", "Concert Tickets", 150, 22, "cat-entertainment"),
	createTx("tx-16", "Student Loan", 300, 1, undefined, "loan"),
	createTx("tx-17", "Savings Transfer", 500, 1, undefined, "transfer"),
	createTx("tx-18", "Paycheck", 2500, 15, undefined, "income"),
	createTx("tx-19", "Paycheck", 2500, 30, undefined, "income"),
];
