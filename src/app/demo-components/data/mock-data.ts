export const MOCK_SERVICE_SUGGESTIONS = [
	{ name: "Netflix", domain: "netflix.com" },
	{ name: "Spotify", domain: "spotify.com" },
	{ name: "Amazon", domain: "amazon.com" },
	{ name: "Google", domain: "google.com" },
	{ name: "Apple", domain: "apple.com" },
	{ name: "Microsoft", domain: "microsoft.com" },
	{ name: "Adobe", domain: "adobe.com" },
	{ name: "Slack", domain: "slack.com" },
];

export const MOCK_DONUT_DATA = [
	{ name: "Assets", value: 150000, color: "#10b981" },
	{ name: "Liabilities", value: 50000, color: "#ef4444" },
];

export const MOCK_NET_WORTH_WIDGET_DATA = {
	netWorth: 100000,
	totalAssets: 150000,
	totalLiabilities: 50000,
	trend: { direction: "up" as const, value: 12.5, period: "vs last month" },
	assetBreakdown: [
		{ category: "Banking", value: 75000, accounts: [] },
		{ category: "Investment", value: 50000, accounts: [] },
		{ category: "Retirement", value: 25000, accounts: [] },
	],
	liabilityBreakdown: [
		{ category: "Credit", value: 35000, accounts: [] },
		{ category: "Debt", value: 15000, accounts: [] },
	],
	trendData: [
		{ date: "Jan", value: 85000 },
		{ date: "Feb", value: 88000 },
		{ date: "Mar", value: 92000 },
		{ date: "Apr", value: 89000 },
		{ date: "May", value: 95000 },
		{ date: "Jun", value: 100000 },
	],
};

export const MOCK_METRIC_CARD_DATA = {
	label: "Monthly Savings",
	value: 2500,
	trend: { direction: "up" as const, value: 12.5, period: "vs last month" },
};

export const MOCK_BUDGET_SUMMARY_DATA = {
	expectedIncome: 9000,
	totalBudgetAllocated: 7500,
	totalSpent: 5200,
};

export const MOCK_ACCOUNT_DATA = {
	id: "demo-1",
	user_id: "demo-user",
	name: "Checking Account",
	account_type_id: "1",
	account_type: {
		id: "1",
		user_id: null,
		name: "Checking",
		class: "asset" as const,
		category: "banking" as const,
		is_tax_advantaged: false,
		icon: null,
		sort_order: 1,
		is_system: true,
		is_active: true,
		created_at: "",
	},
	institution: "Chase Bank",
	account_number_last4: "4521",
	current_balance: 15420.5,
	currency: "CAD",
	credit_limit: null,
	original_amount: null,
	interest_rate: null,
	interest_type: null,
	loan_start_date: null,
	loan_term_months: null,
	payment_due_date: null,
	target_balance: 20000,
	track_contribution_room: false,
	contribution_room: null,
	annual_contribution_limit: null,
	notes: "Primary checking account",
	color: null,
	icon: null,
	percent_change: 8.5,
	display_order: 1,
	is_active: true,
	external_account_id: null,
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
};

export const MOCK_ACCOUNT_LIABILITY = {
	...MOCK_ACCOUNT_DATA,
	id: "demo-2",
	user_id: "demo-user",
	name: "Credit Card",
	account_type_id: "2",
	account_type: {
		id: "2",
		user_id: null,
		name: "Credit Card",
		class: "liability" as const,
		category: "credit" as const,
		is_tax_advantaged: false,
		icon: null,
		sort_order: 2,
		is_system: true,
		is_active: true,
		created_at: "",
	},
	institution: "Visa",
	current_balance: 3500,
	target_balance: null,
	original_amount: 5000,
	percent_change: -5.2,
};

export const MOCK_TRANSACTION_DATA = [
	{
		id: "1",
		account_id: "demo-1",
		user_id: "demo",
		amount: 125.5,
		transaction_type: "withdrawal" as const,
		description: "Grocery Store",
		transaction_date: "2024-01-15",
		linked_allocation_transaction_id: null,
		created_at: "",
	},
	{
		id: "2",
		account_id: "demo-1",
		user_id: "demo",
		amount: 3200.0,
		transaction_type: "deposit" as const,
		description: "Salary Deposit",
		transaction_date: "2024-01-15",
		linked_allocation_transaction_id: null,
		created_at: "",
	},
];
