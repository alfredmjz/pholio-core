"use server";

import { createClient } from "@/lib/supabase/server";
import type { DashboardData, CashflowSummary, AllCashflowData, NetWorthData, Transaction, Period } from "./types";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getSampleDashboardData, getSampleRecentTransactions } from "@/mock-data/dashboard";

/**
 * Fetch all dashboard data for the current user
 */
export async function getDashboardData(): Promise<DashboardData> {
	// Handle sample data / demo mode
	if (await isSampleDataMode()) {
		return getSampleDashboardData();
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return getEmptyDashboardData();
	}

	// Fetch accounts with their types for net worth calculation
	const { data: accounts } = await supabase
		.from("accounts")
		.select(`*, account_type:account_types(*)`)
		.eq("user_id", user.id)
		.eq("is_active", true);

	// Fetch categories for the dashboard transaction dialog
	const { data: categories } = await supabase
		.from("allocation_categories")
		.select("*")
		.eq("user_id", user.id);

	// Fetch account history for trend data
	const { data: history } = await supabase
		.from("account_history")
		.select("balance, recorded_at")
		.eq("user_id", user.id)
		.order("recorded_at", { ascending: true })
		.limit(180); // ~6 months of daily data

	// Compute net worth from accounts
	const netWorthData = computeNetWorthFromAccounts(accounts || [], history || []);

	// Get current month transactions for metrics
	const now = new Date();
	const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
	const { data: monthlyTxs } = await supabase
		.from("transactions")
		.select("amount, transaction_date, source, name, notes")
		.eq("user_id", user.id)
		.gte("transaction_date", startOfMonth);

	// Compute metrics from transactions
	const metrics = computeMetrics(monthlyTxs || [], netWorthData.netWorth);

	// Compute cashflow data from historical transactions
	const cashflow = await computeCashflowData(supabase, user.id);

	// Get recent transactions
	const recentTransactions = await getRecentTransactions(10);

	return {
		metrics,
		cashflow,
		netWorth: netWorthData,
		recentTransactions,
		accounts: (accounts as any[]) || [],
		categories: (categories as any[]) || [],
	};
}

/**
 * Fetch cashflow data for a specific period
 */
export async function getCashflowData(period: Period): Promise<CashflowSummary> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return getEmptyCashflowData(period);
	}

	// If explicitly asked for sample data
	if (await isSampleDataMode()) {
		return getSampleDashboardData().cashflow[period];
	}

	// Return empty data until implemented
	return getEmptyCashflowData(period);
}

/**
 * Fetch net worth data
 */
export async function getNetWorthData(): Promise<NetWorthData> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return getEmptyNetWorthData();
	}

	// If explicitly asked for sample data
	if (await isSampleDataMode()) {
		return getSampleDashboardData().netWorth;
	}

	// Return empty data until implemented
	return getEmptyNetWorthData();
}

/**
 * Fetch recent transactions
 */
export async function getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return [];
	}

	// Query actual transactions from the database
	const { data: transactions, error } = await supabase
		.from("transactions")
		.select(
			`
			id,
			name,
			amount,
			transaction_date,
			source,
			notes,
			allocation_categories (
				name,
				color
			)
		`
		)
		.eq("user_id", user.id)
		.order("transaction_date", { ascending: false })
		.limit(limit);

	if (error || !transactions) {
		Logger.error("Error fetching transactions", { error });
		if (await isSampleDataMode()) {
			return getSampleRecentTransactions();
		}
		return [];
	}

	return transactions.map((t: any) => {
		const isTransfer = isTransferTransaction(t);
		return {
			id: t.id,
			date: t.transaction_date,
			description: t.name,
			category: t.allocation_categories?.name || "Uncategorized",
			amount: Math.abs(t.amount),
			type: t.amount > 0 && !isTransfer ? ("income" as const) : ("expense" as const),
		};
	});
}

// ============================================================================
// Helper Functions - Compute Real Data
// ============================================================================

interface AccountWithType {
	id: string;
	current_balance: number;
	account_type: {
		class: "asset" | "liability";
		category: string;
		name: string;
	} | null;
	name: string;
}

interface HistoryRecord {
	balance: number;
	recorded_at: string;
}

interface TransactionRecord {
	amount: number;
	transaction_date: string;
	source?: string;
	name?: string;
	notes?: string;
}

function isTransferTransaction(t: TransactionRecord): boolean {
	if (t.source === "transfer") return true;
	const name = (t.name || "").toLowerCase();
	const notes = (t.notes || "").toLowerCase();
	return name.includes("transfer") || notes.includes("transfer");
}

/**
 * Compute net worth data from accounts and history
 */
function computeNetWorthFromAccounts(accounts: AccountWithType[], history: HistoryRecord[]): NetWorthData {
	const assetAccounts = accounts.filter((a) => a.account_type?.class === "asset");
	const liabilityAccounts = accounts.filter((a) => a.account_type?.class === "liability");

	const totalAssets = assetAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);
	const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);
	const netWorth = totalAssets - totalLiabilities;

	// Group accounts by category for breakdown
	const assetBreakdown = groupAccountsByCategory(assetAccounts);
	const liabilityBreakdown = groupAccountsByCategory(liabilityAccounts);

	// Compute trend data from history (aggregate by month)
	const trendData = computeTrendData(history);

	return {
		netWorth,
		totalAssets,
		totalLiabilities,
		assetBreakdown,
		liabilityBreakdown,
		trendData,
	};
}

function groupAccountsByCategory(accounts: AccountWithType[]) {
	const grouped: Record<string, { category: string; value: number; accounts: { name: string; value: number }[] }> = {};

	for (const account of accounts) {
		const category = account.account_type?.category || "other";
		if (!grouped[category]) {
			grouped[category] = { category, value: 0, accounts: [] };
		}
		grouped[category].value += Number(account.current_balance);
		grouped[category].accounts.push({
			name: account.name,
			value: Number(account.current_balance),
		});
	}

	return Object.values(grouped);
}

function computeTrendData(history: HistoryRecord[]): { date: string; value: number }[] {
	if (history.length === 0) return [];

	// Group by month and sum balances
	const monthlyTotals: Record<string, number> = {};
	for (const h of history) {
		const month = h.recorded_at.substring(0, 7); // YYYY-MM
		monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(h.balance);
	}

	// Take last 6 months
	const sortedMonths = Object.keys(monthlyTotals).sort().slice(-6);
	return sortedMonths.map((month) => ({
		date: new Date(month + "-01").toLocaleDateString("en-US", { month: "short" }),
		value: monthlyTotals[month],
	}));
}

/**
 * Compute metrics from monthly transactions
 */
function computeMetrics(transactions: TransactionRecord[], netWorth: number): DashboardData["metrics"] {
	const monthlyIncome = transactions
		.filter((t) => t.amount > 0 && !isTransferTransaction(t))
		.reduce((sum, t) => sum + Number(t.amount), 0);

	const monthlyExpenses = transactions
		.filter((t) => t.amount < 0 && !isTransferTransaction(t))
		.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

	const savingsRate = monthlyIncome - monthlyExpenses;

	return {
		netWorth: { label: "Net Worth", value: netWorth },
		monthlyIncome: { label: "Monthly Income", value: monthlyIncome },
		monthlyExpenses: { label: "Monthly Expenses", value: monthlyExpenses },
		savingsRate: { label: "Savings Rate", value: savingsRate },
	};
}

/**
 * Compute cashflow data from historical transactions
 */
async function computeCashflowData(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string
): Promise<AllCashflowData> {
	const now = new Date();

	// Fetch last 12 months of transactions for all periods
	const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
	const { data: transactions } = await supabase
		.from("transactions")
		.select("amount, transaction_date, source, name, notes")
		.eq("user_id", userId)
		.gte("transaction_date", startDate.toISOString().split("T")[0])
		.order("transaction_date", { ascending: true });

	const txs = transactions || [];

	return {
		month: computeCashflowForPeriod(txs, "month"),
		quarter: computeCashflowForPeriod(txs, "quarter"),
		year: computeCashflowForPeriod(txs, "year"),
	};
}

function computeCashflowForPeriod(transactions: TransactionRecord[], period: Period): CashflowSummary {
	const now = new Date();
	const grouped: Record<string, { income: number; expenses: number }> = {};

	for (const tx of transactions) {
		if (isTransferTransaction(tx)) {
			// Skip internal transfers from income and expenses totals
			continue;
		}

		const date = new Date(tx.transaction_date);
		let key: string;
		let label: string;

		if (period === "month") {
			key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
			label = date.toLocaleDateString("en-US", { month: "short" });
		} else if (period === "quarter") {
			const quarter = Math.floor(date.getMonth() / 3) + 1;
			key = `${date.getFullYear()}-Q${quarter}`;
			label = `Q${quarter} ${date.getFullYear()}`;
		} else {
			key = String(date.getFullYear());
			label = String(date.getFullYear());
		}

		if (!grouped[key]) {
			grouped[key] = { income: 0, expenses: 0 };
		}

		if (tx.amount > 0) {
			grouped[key].income += Number(tx.amount);
		} else {
			grouped[key].expenses += Math.abs(Number(tx.amount));
		}
	}

	// Convert to array and take last N entries based on period
	const limit = period === "month" ? 6 : period === "quarter" ? 4 : 3;
	const sortedKeys = Object.keys(grouped).sort().slice(-limit);

	const data = sortedKeys.map((key) => {
		let label: string;
		if (period === "month") {
			const [year, month] = key.split("-");
			label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short" });
		} else if (period === "quarter") {
			label = key.replace("-", " ");
		} else {
			label = key;
		}

		return {
			date: key,
			label,
			income: grouped[key].income,
			expenses: grouped[key].expenses,
		};
	});

	const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
	const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0);

	return {
		totalIncome,
		totalExpenses,
		netCashflow: totalIncome - totalExpenses,
		period,
		data,
	};
}

// ============================================================================
// Helper Functions - Empty Data
// ============================================================================

function getEmptyDashboardData(): DashboardData {
	return {
		metrics: {
			netWorth: { label: "Net Worth", value: 0 },
			monthlyIncome: { label: "Monthly Income", value: 0 },
			monthlyExpenses: { label: "Monthly Expenses", value: 0 },
			savingsRate: { label: "Savings Rate", value: 0 },
		},
		cashflow: getEmptyAllCashflowData(),
		netWorth: getEmptyNetWorthData(),
		recentTransactions: [],
	};
}

function getEmptyCashflowData(period: Period): CashflowSummary {
	return {
		totalIncome: 0,
		totalExpenses: 0,
		netCashflow: 0,
		period,
		data: [],
	};
}

function getEmptyAllCashflowData(): AllCashflowData {
	return {
		month: getEmptyCashflowData("month"),
		quarter: getEmptyCashflowData("quarter"),
		year: getEmptyCashflowData("year"),
	};
}

function getEmptyNetWorthData(): NetWorthData {
	return {
		netWorth: 0,
		totalAssets: 0,
		totalLiabilities: 0,
		assetBreakdown: [],
		liabilityBreakdown: [],
		trendData: [],
	};
}
