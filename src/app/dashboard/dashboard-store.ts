import { Logger } from "@/lib/logger";
import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import { getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import { promotionStore } from "@/lib/actions/promotion-store";
import { settingsStore } from "@/app/settings/settings-store";
import { listRecurringExpenses } from "@/app/recurring/recurring-store";
import { isRecurringTransfer } from "@/app/recurring/recurring-occurrence";
import type { RecurringExpense } from "@/app/recurring/recurring-types";
import type { AccountWithType } from "@/app/accounts/types";
import type { AllocationSummary } from "@/app/allocations/types";
import { getSampleDashboardData, getSampleRecentTransactions } from "@/mock-data/dashboard";
import type { DashboardAccount, DashboardData, Transaction } from "./types";
import { buildNetWorthSeries } from "./net-worth-series";
import {
	CASHFLOW_MONTHS,
	getAllocationSummaryOnce,
	getDashboardReads,
	getHistoricalPaceOnce,
	getRecurringExpensesOnce,
} from "./dashboard-reads";
import { computeMonthPace } from "./month-pace";
import { buildMonthlyCashflow, isTransfer } from "./cashflow";
import { buildHeadsUp, selectUpcomingBills, type BillInput } from "./heads-up";

const RECENT_LIMIT = 8;

export interface DashboardStore {
	/** Everything the dashboard renders. Reads only: nothing here creates allocations or syncs recurring items. */
	getData(): Promise<DashboardData>;
	recentTransactions(limit: number): Promise<Transaction[]>;
}

export function dashboardStore(ctx: DataContext): DashboardStore {
	return ctx.kind === "demo" ? demoDashboardStore(ctx) : supabaseDashboardStore(ctx);
}

/** Bills and subscriptions; recurring transfers move money between the user's own accounts. */
export const isBill = (expense: RecurringExpense) => !isRecurringTransfer(expense);

export function toBillInput(expense: RecurringExpense): BillInput {
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

export function emptyDashboardData(today: string): DashboardData {
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

function supabaseDashboardStore(ctx: SupabaseContext): DashboardStore {
	const { db, userId } = ctx;

	const recentTransactions = async (limit: number): Promise<Transaction[]> => {
		const { data: transactions, error } = await db
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
			.eq("user_id", userId)
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
	};

	return {
		recentTransactions,

		async getData() {
			const timezone = await settingsStore(ctx).getTimezone();
			const today = getTodayDateString(timezone ?? undefined);
			const todayDate = parseLocalDate(today);
			const year = todayDate.getFullYear();
			const month = todayDate.getMonth() + 1;

			const { accounts, records, ledger, allocationId } = await getDashboardReads(userId, today);

			const [summary, typicalPace, recurring, recent, promotions] = await Promise.all([
				allocationId ? getAllocationSummaryOnce(allocationId) : Promise.resolve<AllocationSummary | null>(null),
				getHistoricalPaceOnce(year, month),
				getRecurringExpensesOnce(),
				recentTransactions(RECENT_LIMIT),
				promotionStore(ctx).listOpen(today),
			]);

			const balanceAccounts = accounts.map((a) => ({
				id: a.id,
				class: a.account_type?.class === "liability" ? ("liability" as const) : ("asset" as const),
				balance: Number(a.current_balance),
			}));
			const history = buildNetWorthSeries(balanceAccounts, records, today);
			const latest = history[history.length - 1];

			const transactions = ledger.map((t) => ({
				date: String(t.transaction_date).slice(0, 10),
				amount: Number(t.amount),
				source: t.source ?? null,
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

			const bills = recurring.filter(isBill).map(toBillInput);
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
				recentTransactions: recent,
				accounts,
				categories,
			};
		},
	};
}

function demoDashboardStore(ctx: DemoContext): DashboardStore {
	return {
		async getData() {
			const bills = (await listRecurringExpenses(ctx)).filter(isBill).map(toBillInput);
			return getSampleDashboardData(undefined, bills);
		},
		async recentTransactions(limit) {
			return getSampleRecentTransactions().slice(0, limit);
		},
	};
}
