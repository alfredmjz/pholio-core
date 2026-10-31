"use server";

import { createClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { getSampleDashboardData } from "@/mock-data/dashboard";
import { getTimezone } from "@/app/settings/actions";
import { getAllocationSummary, getHistoricalPace } from "@/app/allocations/actions";
import { getRecurringExpenses, type RecurringExpense } from "@/app/recurring/actions";
import { getOpenPromotions } from "@/lib/actions/promotion-actions";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import type { AccountWithType } from "@/app/accounts/types";
import type { AllocationSummary } from "@/app/allocations/types";
import type { DashboardAccount, DashboardData, Transaction } from "./types";
import { buildNetWorthSeries, rangeStartDate, type BalanceRecord } from "./net-worth-series";
import { computeMonthPace } from "./month-pace";
import { buildMonthlyCashflow, cashflowWindowStart, isTransfer } from "./cashflow";
import { buildHeadsUp, selectUpcomingBills, type BillInput } from "./heads-up";

const CASHFLOW_MONTHS = 6;
const RECENT_LIMIT = 8;

/**
 * Fetch all dashboard data for the current user.
 * Reads only: nothing here creates allocations or syncs recurring items.
 */
export async function getDashboardData(): Promise<DashboardData> {
	if (await isSampleDataMode()) {
		return getSampleDashboardData(undefined, (await getRecurringExpenses()).map(toBillInput));
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const timezone = user ? await getTimezone() : null;
	const today = getTodayDateString(timezone ?? undefined);

	if (!user) {
		return getEmptyDashboardData(today);
	}

	const todayDate = parseLocalDate(today);
	const year = todayDate.getFullYear();
	const month = todayDate.getMonth() + 1;

	const [accountsResult, historyResult, transactionsResult, allocationResult] = await Promise.all([
		supabase.from("accounts").select(`*, account_type:account_types(*)`).eq("user_id", user.id).eq("is_active", true),
		supabase
			.from("account_history")
			.select("account_id, balance, recorded_at")
			.eq("user_id", user.id)
			.gte("recorded_at", rangeStartDate("1Y", today))
			.order("recorded_at", { ascending: true }),
		supabase
			.from("transactions")
			.select("amount, transaction_date, source")
			.eq("user_id", user.id)
			.gte("transaction_date", cashflowWindowStart(today, CASHFLOW_MONTHS))
			.lte("transaction_date", today),
		supabase.from("allocations").select("id").eq("user_id", user.id).eq("year", year).eq("month", month).maybeSingle(),
	]);

	for (const [label, result] of Object.entries({
		accounts: accountsResult,
		history: historyResult,
		transactions: transactionsResult,
		allocation: allocationResult,
	})) {
		if (result.error) Logger.error(`Dashboard: error fetching ${label}`, { error: result.error });
	}

	const accounts = (accountsResult.data ?? []) as AccountWithType[];
	const allocationId = (allocationResult.data as { id: string } | null)?.id;

	const [summary, typicalPace, recurring, recentTransactions, promotions] = await Promise.all([
		allocationId ? getAllocationSummary(allocationId) : Promise.resolve<AllocationSummary | null>(null),
		getHistoricalPace(year, month),
		getRecurringExpenses(),
		getRecentTransactions(RECENT_LIMIT),
		getOpenPromotions(today),
	]);

	const balanceAccounts = accounts.map((a) => ({
		id: a.id,
		class: a.account_type?.class === "liability" ? ("liability" as const) : ("asset" as const),
		balance: Number(a.current_balance),
	}));
	const records: BalanceRecord[] = (historyResult.data ?? []).map((h) => ({
		accountId: h.account_id,
		balance: Number(h.balance),
		date: String(h.recorded_at).slice(0, 10),
	}));
	const history = buildNetWorthSeries(balanceAccounts, records, today);
	const latest = history[history.length - 1];

	const transactions = (transactionsResult.data ?? []).map((t) => ({
		date: String(t.transaction_date).slice(0, 10),
		amount: Number(t.amount),
		source: t.source as string | null,
	}));

	const monthPrefix = today.slice(0, 7);
	const monthPace =
		summary && summary.summary.total_budget_caps > 0
			? computeMonthPace({
					year,
					month,
					today,
					budget: Number(summary.summary.total_budget_caps),
					expenses: transactions
						.filter((t) => t.amount < 0 && !isTransfer(t) && t.date.startsWith(monthPrefix))
						.map((t) => ({ date: t.date, amount: Math.abs(t.amount) })),
					typicalCurve: typicalPace.hasEnoughData ? typicalPace.dailyAmounts : null,
				})
			: null;

	const bills = recurring.map(toBillInput);

	const categories = summary?.categories ?? [];

	return {
		today,
		netWorth: {
			current: latest.value,
			totalAssets: latest.assets,
			totalLiabilities: latest.liabilities,
			history,
		},
		accountsSummary: accounts.map(toDashboardAccount),
		monthPace,
		cashflow: buildMonthlyCashflow(transactions, today, CASHFLOW_MONTHS),
		upcomingBills: selectUpcomingBills(bills, today),
		headsUp: buildHeadsUp({
			today,
			bills,
			categories: categories.map((c) => ({
				id: c.id,
				name: c.name,
				budget: Number(c.budget_cap),
				spent: Number(c.actual_spend),
			})),
			promotions,
		}),
		recentTransactions,
		accounts,
		categories,
	};
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

	const { data: transactions, error } = await supabase
		.from("transactions")
		.select(
			`
			id,
			name,
			amount,
			transaction_date,
			source,
			allocation_categories (
				name
			)
		`
		)
		.eq("user_id", user.id)
		.order("transaction_date", { ascending: false })
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error || !transactions) {
		Logger.error("Error fetching transactions", { error });
		return [];
	}

	return transactions.map((t: any) => ({
		id: t.id,
		date: String(t.transaction_date).slice(0, 10),
		description: t.name,
		category: isTransfer(t) ? "Transfer" : t.allocation_categories?.name || "Uncategorized",
		amount: Math.abs(Number(t.amount)),
		type: isTransfer(t) ? ("transfer" as const) : t.amount > 0 ? ("income" as const) : ("expense" as const),
	}));
}

function toBillInput(expense: RecurringExpense): BillInput {
	return {
		id: expense.id,
		name: expense.name,
		amount: Number(expense.amount),
		dueDate: expense.next_due_date,
		status: expense.status,
		isActive: expense.is_active,
		serviceProvider: expense.service_provider,
	};
}

function toDashboardAccount(account: AccountWithType): DashboardAccount {
	return {
		id: account.id,
		name: account.name,
		institution: account.institution,
		typeName: account.account_type?.name ?? "Account",
		class: account.account_type?.class === "liability" ? "liability" : "asset",
		balance: Number(account.current_balance),
		isInvestment: isInvestmentAccount(account),
	};
}

function getEmptyDashboardData(today: string): DashboardData {
	return {
		today,
		netWorth: {
			current: 0,
			totalAssets: 0,
			totalLiabilities: 0,
			history: [{ date: today, value: 0, assets: 0, liabilities: 0 }],
		},
		accountsSummary: [],
		monthPace: null,
		cashflow: buildMonthlyCashflow([], today, CASHFLOW_MONTHS),
		upcomingBills: [],
		headsUp: [],
		recentTransactions: [],
	};
}
