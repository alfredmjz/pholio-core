import type { DataContext, DemoContext, SupabaseContext } from "@/lib/data-context.server";
import { getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { settingsStore } from "@/app/settings/settings-store";
import { listRecurringExpenses } from "@/app/recurring/recurring-store";
import { buildNetWorthSeries, rangeStartDate, recordsSince } from "@/app/dashboard/net-worth-series";
import {
	getAllocationSummaryOnce,
	getDashboardReads,
	getHistoricalPaceOnce,
	getRecurringExpensesOnce,
} from "@/app/dashboard/dashboard-reads";
import { isBill, toBillInput } from "@/app/dashboard/dashboard-store";
import { computeMonthPace } from "@/app/dashboard/month-pace";
import { computeWeather, toWeatherTransactions, type Weather } from "@/lib/financial-weather";
import { accountsForWeather, billsForWeather } from "@/lib/weather-input";
import { getSampleWeatherInput } from "@/mock-data/dashboard";

export interface WeatherStore {
	/** Today's weather. Reads only. */
	today(): Promise<Weather>;
}

export function weatherStore(ctx: DataContext): WeatherStore {
	return ctx.kind === "demo" ? demoWeatherStore(ctx) : supabaseWeatherStore(ctx);
}

function supabaseWeatherStore(ctx: SupabaseContext): WeatherStore {
	return {
		async today() {
			const today = getTodayDateString((await settingsStore(ctx).getTimezone()) ?? undefined);
			const todayDate = parseLocalDate(today);
			const year = todayDate.getFullYear();
			const month = todayDate.getMonth() + 1;

			const { accounts, records, ledger, allocationId } = await getDashboardReads(ctx.userId, today);
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
				...billsForWeather(recurring.filter(isBill).map(toBillInput), today),
				...accountsForWeather(accounts),
			}).weather;
		},
	};
}

function demoWeatherStore(ctx: DemoContext): WeatherStore {
	return {
		async today() {
			const bills = (await listRecurringExpenses(ctx)).filter(isBill).map(toBillInput);
			return computeWeather(getSampleWeatherInput(undefined, bills)).weather;
		},
	};
}
