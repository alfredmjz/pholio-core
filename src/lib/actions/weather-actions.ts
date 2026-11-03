"use server";

import { getAuthUser } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { getTimezone } from "@/app/settings/actions";
import { getRecurringExpenses, type RecurringExpense } from "@/app/recurring/actions";
import { isRecurringTransfer } from "@/app/recurring/recurring-occurrence";
import type { BillInput } from "@/app/dashboard/heads-up";
import { buildNetWorthSeries, rangeStartDate, recordsSince } from "@/app/dashboard/net-worth-series";
import {
	getAllocationSummaryOnce,
	getDashboardReads,
	getHistoricalPaceOnce,
	getRecurringExpensesOnce,
} from "@/app/dashboard/dashboard-reads";
import { computeMonthPace } from "@/app/dashboard/month-pace";
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
			const bills = (await getRecurringExpenses()).filter((r) => !isRecurringTransfer(r)).map(toBillInput);
			return computeWeather(getSampleWeatherInput(undefined, bills)).weather;
		}

		const user = await getAuthUser();
		if (!user) return null;

		const today = getTodayDateString((await getTimezone()) ?? undefined);
		const todayDate = parseLocalDate(today);
		const year = todayDate.getFullYear();
		const month = todayDate.getMonth() + 1;

		const { accounts, records, ledger, allocationId } = await getDashboardReads(user.id, today);
		const transactions = toWeatherTransactions(ledger);

		const [summary, typicalPace, recurring] = await Promise.all([
			allocationId ? getAllocationSummaryOnce(allocationId) : Promise.resolve(null),
			getHistoricalPaceOnce(year, month),
			getRecurringExpensesOnce(),
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

		const netWorth = buildNetWorthSeries(
			accounts.map((a) => ({
				id: a.id,
				class: a.account_type?.class === "liability" ? ("liability" as const) : ("asset" as const),
				balance: Number(a.current_balance),
			})),
			recordsSince(records, rangeStartDate("6M", today)),
			today
		);

		return computeWeather({
			today,
			transactions,
			monthPace,
			netWorth,
			...billsForWeather(recurring.filter((r) => !isRecurringTransfer(r)).map(toBillInput), today),
			...accountsForWeather(accounts),
		}).weather;
	} catch (error) {
		// The backdrop is decoration: a failure here must never break the page.
		Logger.error("Weather: could not compute", { error });
		return "cloudy";
	}
}
