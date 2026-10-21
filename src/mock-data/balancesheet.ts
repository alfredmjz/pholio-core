import type {
	AccountType,
	AccountWithType,
	BalanceSheetSummary,
	AccountTransaction,
	HistoricalDataPoint,
	AccountHistory,
} from "@/app/balancesheet/types";
import type { RecentActivityItem } from "@/app/balancesheet/actions";
import { getDemoNow, daysBefore, toDateOnly } from "./demo-date";

// Sample account types (mimicking system defaults)
export const sampleAccountTypes: AccountType[] = [
	{
		id: "type-1",
		user_id: null,
		name: "Chequing",
		code: "chequing",
		class: "asset",
		category: "banking",
		is_tax_advantaged: false,
		icon: "wallet",
		sort_order: 1,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-2",
		user_id: null,
		name: "Savings",
		code: "savings",
		class: "asset",
		category: "banking",
		is_tax_advantaged: false,
		icon: "piggy-bank",
		sort_order: 2,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-3",
		user_id: null,
		name: "Investment",
		code: "investment",
		class: "asset",
		category: "investment",
		is_tax_advantaged: false,
		icon: "trending-up",
		sort_order: 3,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-4",
		user_id: null,
		name: "Line of Credit",
		code: "line_of_credit",
		class: "liability",
		category: "credit",
		is_tax_advantaged: false,
		icon: "minus-circle",
		sort_order: 4,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-5",
		user_id: null,
		name: "Mortgage",
		code: "mortgage",
		class: "liability",
		category: "debt",
		is_tax_advantaged: false,
		icon: "home",
		sort_order: 5,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-6",
		user_id: null,
		name: "Credit Card",
		code: "credit_card",
		class: "liability",
		category: "credit",
		is_tax_advantaged: false,
		icon: "credit-card",
		sort_order: 6,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-7",
		user_id: null,
		name: "Loans",
		code: "loan",
		class: "liability",
		category: "debt",
		is_tax_advantaged: false,
		icon: "file-text",
		sort_order: 7,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-8",
		user_id: null,
		name: "Other (Asset)",
		code: "other",
		class: "asset",
		category: "other",
		is_tax_advantaged: false,
		icon: "circle-help",
		sort_order: 8,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
	{
		id: "type-9",
		user_id: null,
		name: "Other (Liability)",
		code: "other",
		class: "liability",
		category: "other",
		is_tax_advantaged: false,
		icon: "circle-help",
		sort_order: 9,
		is_system: true,
		is_active: true,
		created_at: "2024-01-01",
	},
];

export const sampleAccounts: AccountWithType[] = [
	// Assets
	{
		id: "acc-1",
		user_id: "sample-user",
		name: "Emergency Fund",
		account_type_id: "type-2",
		account_type: sampleAccountTypes[1],
		institution: "Ally Bank",
		account_number_last4: null,
		current_balance: 8500,
		currency: "CAD",
		credit_limit: null,
		original_amount: null,
		interest_rate: 0.045,
		interest_type: "compound",
		loan_start_date: null,
		loan_term_months: null,
		payment_due_date: null,
		target_balance: 10000,
		track_contribution_room: false,
		contribution_plan: null,
		contribution_room: null,
		contribution_room_as_of: null,
		annual_contribution_limit: null,
		notes: "High-yield savings for emergencies",
		color: null,
		icon: null,
		percent_change: 6.4,
		display_order: 1,
		is_active: true,
		external_account_id: null,
		created_at: "2024-01-15T10:00:00Z",
		updated_at: "2024-12-15T10:00:00Z",
	},
	{
		id: "acc-2",
		user_id: "sample-user",
		name: "Robinhood",
		account_type_id: "type-3",
		account_type: sampleAccountTypes[2],
		institution: "Robinhood",
		account_number_last4: null,
		current_balance: 32100,
		currency: "CAD",
		credit_limit: null,
		original_amount: null,
		interest_rate: null,
		interest_type: null,
		loan_start_date: null,
		loan_term_months: null,
		payment_due_date: null,
		target_balance: 50000,
		track_contribution_room: false,
		contribution_plan: null,
		contribution_room: null,
		contribution_room_as_of: null,
		annual_contribution_limit: null,
		notes: "Index funds and stocks",
		color: null,
		icon: null,
		percent_change: 12.3,
		display_order: 2,
		is_active: true,
		external_account_id: null,
		created_at: "2023-06-01T10:00:00Z",
		updated_at: "2024-12-15T10:00:00Z",
	},
	{
		id: "acc-3",
		user_id: "sample-user",
		name: "TFSA",
		account_type_id: "type-3",
		account_type: sampleAccountTypes[2],
		institution: "Wealthsimple",
		account_number_last4: null,
		current_balance: 45000,
		currency: "CAD",
		credit_limit: null,
		original_amount: null,
		interest_rate: null,
		interest_type: null,
		loan_start_date: null,
		loan_term_months: null,
		payment_due_date: null,
		target_balance: 95000,
		// Contribution room tracking enabled
		track_contribution_room: true,
		contribution_plan: "tfsa",
		// TFSA room is shared by every TFSA account, so it lives in the plan room
		// (getSampleContributionRooms), not on the account.
		contribution_room: null,
		contribution_room_as_of: null,
		annual_contribution_limit: null,
		notes: "Tax-free savings for retirement",
		color: null,
		icon: null,
		percent_change: -2.1,
		display_order: 3,
		is_active: true,
		external_account_id: null,
		created_at: "2022-03-10T10:00:00Z",
		updated_at: "2024-12-15T10:00:00Z",
	},

	// Liabilities
	{
		id: "acc-4",
		user_id: "sample-user",
		name: "Chase Sapphire Reserve",
		account_type_id: "type-6",
		account_type: sampleAccountTypes[5],
		institution: "Chase",
		account_number_last4: "4521",
		current_balance: 2450,
		currency: "CAD",
		credit_limit: 15000,
		original_amount: null,
		interest_rate: 0.2499,
		interest_type: "compound",
		loan_start_date: null,
		loan_term_months: null,
		payment_due_date: null,
		target_balance: null,
		track_contribution_room: false,
		contribution_plan: null,
		contribution_room: null,
		contribution_room_as_of: null,
		annual_contribution_limit: null,
		notes: "Pay in full each month",
		color: null,
		icon: null,
		display_order: 1,
		is_active: true,
		external_account_id: null,
		created_at: "2023-01-05T10:00:00Z",
		updated_at: "2024-12-15T10:00:00Z",
	},
	{
		id: "acc-5",
		user_id: "sample-user",
		name: "Student Loans",
		account_type_id: "type-7",
		account_type: sampleAccountTypes[6],
		institution: "Navient",
		account_number_last4: null,
		current_balance: 18500,
		currency: "CAD",
		credit_limit: null,
		original_amount: 25000,
		interest_rate: 0.055,
		interest_type: "compound",
		loan_start_date: "2020-09-01",
		loan_term_months: 120,
		payment_due_date: null,
		target_balance: null,
		track_contribution_room: false,
		contribution_plan: null,
		contribution_room: null,
		contribution_room_as_of: null,
		annual_contribution_limit: null,
		notes: "Minimum payment $285/mo",
		color: null,
		icon: null,
		display_order: 2,
		is_active: true,
		external_account_id: null,
		created_at: "2020-09-01T10:00:00Z",
		updated_at: "2024-12-15T10:00:00Z",
	},
];

// Helper to generate mock historical data for the last 30 days
const generateHistoricalData = (startValue: number, endValue: number, variance: number = 0.01, now: Date = getDemoNow()) => {
	const points: HistoricalDataPoint[] = [];
	const steps = 30;

	for (let i = steps; i >= 0; i--) {
		const date = new Date(now);
		date.setDate(now.getDate() - i);

		// Linear interpolation with some noise
		const progress = (steps - i) / steps;
		const baseValue = startValue + progress * (endValue - startValue);
		const noise = baseValue * (Math.random() * variance * 2 - variance);

		points.push({
			date: toDateOnly(date),
			value: Math.round(baseValue + noise),
			hasActivity: Math.random() > 0.8, // Simulate activity on ~20% of days
		});
	}
	return points;
};

export function getSampleBalanceSheetSummary(now: Date = getDemoNow()): BalanceSheetSummary {
	return {
		totalAssets: 85600,
		totalLiabilities: 20950,
		netWorth: 64650,
		previousTotalAssets: 82500,
		previousTotalLiabilities: 21200,
		previousNetWorth: 61300,
		historicalAssets: generateHistoricalData(81000, 85600, 0.005, now),
		historicalLiabilities: generateHistoricalData(21500, 20950, 0.003, now),
		assetAccounts: sampleAccounts.filter((acc) => acc.account_type?.class === "asset"),
		liabilityAccounts: sampleAccounts.filter((acc) => acc.account_type?.class === "liability"),
	};
}

export function getSampleAccountTransactions(now: Date = getDemoNow()): Record<string, AccountTransaction[]> {
	const at = (daysAgo: number) => ({
		transaction_date: toDateOnly(daysBefore(now, daysAgo)),
		created_at: daysBefore(now, daysAgo).toISOString(),
	});

	return {
		"acc-1": [
			{
				id: "txn-1",
				account_id: "acc-1",
				user_id: "sample-user",
				amount: 500,
				transaction_type: "deposit",
				description: "Monthly savings",
				...at(2),
				linked_allocation_transaction_id: "tx-linked-savings",
			},
			{
				id: "txn-2",
				account_id: "acc-1",
				user_id: "sample-user",
				amount: 14.22,
				transaction_type: "interest",
				description: "Monthly compound interest",
				...at(16),
				linked_allocation_transaction_id: null,
			},
		],
		"acc-3": [
			{
				id: "txn-3",
				account_id: "acc-3",
				user_id: "sample-user",
				amount: 500,
				transaction_type: "contribution",
				description: "Monthly TFSA contribution",
				...at(16),
				linked_allocation_transaction_id: null,
			},
		],
		"acc-4": [
			{
				id: "txn-4",
				account_id: "acc-4",
				user_id: "sample-user",
				amount: 300,
				transaction_type: "payment",
				description: "Payment",
				...at(7),
				linked_allocation_transaction_id: "tx-linked-debt",
			},
		],
	};
}

export function getSampleAccountHistory(now: Date = getDemoNow()): Record<string, AccountHistory[]> {
	const build = (accountId: string, startValue: number, endValue: number, variance: number): AccountHistory[] =>
		generateHistoricalData(startValue, endValue, variance, now).map((p, i) => ({
			id: `h-${accountId}-${i}`,
			account_id: accountId,
			user_id: "sample-user",
			balance: p.value,
			recorded_at: p.date,
			source: "auto",
			created_at: p.date,
		}));

	return {
		"acc-1": build("acc-1", 7500, 8500, 0.005),
		"acc-2": build("acc-2", 28000, 32100, 0.01),
		"acc-3": build("acc-3", 40000, 45000, 0.002),
		"acc-4": build("acc-4", 3000, 2450, 0.003),
		"acc-5": build("acc-5", 20000, 18500, 0.001),
	};
}

// Helper to generate recent timestamps for mock activity
const getRecentTimestamp = (now: Date, minutesAgo: number): string => {
	const date = new Date(now);
	date.setMinutes(date.getMinutes() - minutesAgo);
	return date.toISOString();
};

export function getSampleRecentActivity(now: Date = getDemoNow()): RecentActivityItem[] {
	return [
		{
			id: "activity-1",
			accountId: "acc-1",
			accountName: "Emergency Fund",
			type: "transaction",
			transactionType: "deposit",
			amount: 500,
			description: "Monthly savings deposit",
			timestamp: getRecentTimestamp(now, 15), // 15 minutes ago
		},
		{
			id: "activity-2",
			accountId: "acc-2",
			accountName: "Robinhood",
			type: "transaction",
			transactionType: "adjustment",
			amount: 1247.5,
			description: "Portfolio value increased",
			timestamp: getRecentTimestamp(now, 120), // 2 hours ago
		},
		{
			id: "activity-3",
			accountId: "acc-3",
			accountName: "TFSA",
			type: "account_created",
			timestamp: getRecentTimestamp(now, 60 * 24), // Yesterday
		},
		{
			id: "activity-4",
			accountId: "acc-5",
			accountName: "Student Loans",
			type: "transaction",
			transactionType: "payment",
			amount: 450,
			description: "Monthly payment processed",
			timestamp: getRecentTimestamp(now, 60 * 26), // Yesterday
		},
		{
			id: "activity-5",
			accountId: "acc-4",
			accountName: "Chase Sapphire Reserve",
			type: "transaction",
			transactionType: "payment",
			amount: 300,
			description: "Statement payment",
			timestamp: getRecentTimestamp(now, 60 * 48), // 2 days ago
		},
	];
}
