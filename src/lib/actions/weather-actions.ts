"use server";

import { createClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { getTimezone } from "@/app/settings/actions";
import { getAllocationSummary, getHistoricalPace } from "@/app/allocations/actions";
import { getRecurringExpenses, type RecurringExpense } from "@/app/recurring/actions";
import type { AccountWithType } from "@/app/accounts/types";
import type { BillInput } from "@/app/dashboard/heads-up";
import { buildNetWorthSeries, rangeStartDate, type BalanceRecord } from "@/app/dashboard/net-worth-series";
import { computeMonthPace } from "@/app/dashboard/month-pace";
import { cashflowWindowStart } from "@/app/dashboard/cashflow";
import { computeWeather, toWeatherTransactions, type Weather } from "@/lib/financial-weather";
import { accountsForWeather, billsForWeather } from "@/lib/weather-input";
import { getSampleWeatherInput } from "@/mock-data/dashboard";

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

/** Today's weather for the signed-in user, or null when nobody is signed in. Reads only. */
export async function getFinancialWeather(): Promise<Weather | null> {
	try {
		if (await isSampleDataMode()) {
			const bills = (await getRecurringExpenses()).map(toBillInput);
			return computeWeather(getSampleWeatherInput(undefined, bills)).weather;
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return null;

		const today = getTodayDateString((await getTimezone()) ?? undefined);
		const todayDate = parseLocalDate(today);
		const year = todayDate.getFullYear();
		const month = todayDate.getMonth() + 1;

		const [accountsResult, historyResult, transactionsResult, allocationResult] = await Promise.all([
			supabase
				.from("accounts")
				.select("id, current_balance, credit_limit, account_type:account_types(class, code)")
				.eq("user_id", user.id)
				.eq("is_active", true),
			supabase
				.from("account_history")
				.select("account_id, balance, recorded_at")
				.eq("user_id", user.id)
				.gte("recorded_at", rangeStartDate("6M", today))
				.order("recorded_at", { ascending: true }),
			supabase
				.from("transactions")
				.select("amount, transaction_date, source")
				.eq("user_id", user.id)
				.gte("transaction_date", cashflowWindowStart(today, 6))
				.lte("transaction_date", today),
			supabase
				.from("allocations")
				.select("id")
				.eq("user_id", user.id)
				.eq("year", year)
				.eq("month", month)
				.maybeSingle(),
		]);

		for (const [label, result] of Object.entries({
			accounts: accountsResult,
			history: historyResult,
			transactions: transactionsResult,
			allocation: allocationResult,
		})) {
			if (result.error) Logger.error(`Weather: error fetching ${label}`, { error: result.error });
		}

		const accounts = (accountsResult.data ?? []) as unknown as AccountWithType[];
		const allocationId = (allocationResult.data as { id: string } | null)?.id;
		const transactions = toWeatherTransactions(transactionsResult.data ?? []);

		const [summary, typicalPace, recurring] = await Promise.all([
			allocationId ? getAllocationSummary(allocationId) : Promise.resolve(null),
			getHistoricalPace(year, month),
			getRecurringExpenses(),
		]);

		const budget = Number(summary?.summary.total_budget_caps ?? 0);
		const monthPrefix = today.slice(0, 7);
		const monthPace =
			budget > 0
				? computeMonthPace({
						year,
						month,
						today,
						budget,
						expenses: transactions
							.filter((t) => t.amount < 0 && t.date.startsWith(monthPrefix))
							.map((t) => ({ date: t.date, amount: Math.abs(t.amount) })),
						typicalCurve: typicalPace.hasEnoughData ? typicalPace.dailyAmounts : null,
					})
				: null;

		const records: BalanceRecord[] = (historyResult.data ?? []).map((h) => ({
			accountId: h.account_id,
			balance: Number(h.balance),
			date: String(h.recorded_at).slice(0, 10),
		}));
		const netWorth = buildNetWorthSeries(
			accounts.map((a) => ({
				id: a.id,
				class: a.account_type?.class === "liability" ? ("liability" as const) : ("asset" as const),
				balance: Number(a.current_balance),
			})),
			records,
			today
		);

		return computeWeather({
			today,
			transactions,
			monthPace,
			netWorth,
			...billsForWeather(recurring.map(toBillInput), today),
			...accountsForWeather(accounts),
		}).weather;
	} catch (error) {
		// The backdrop is decoration: a failure here must never break the page.
		Logger.error("Weather: could not compute", { error });
		return "cloudy";
	}
}
