import { formatDateString, getDaysInMonth, parseLocalDate } from "@/lib/date-utils";

export type PayCadence = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface IncomeDeposit {
	/** YYYY-MM-DD (an ISO timestamp is accepted; only the date part is read). */
	date: string;
	/** Amount received, as a positive number. */
	amount: number;
}

export interface PaySchedule {
	/** Null when the income has no regular rhythm. */
	cadence: PayCadence | null;
	/** YYYY-MM-DD. The first of next month when the cadence is unknown. */
	nextPayday: string;
}

export const INCOME_LOOKBACK_DAYS = 120;

const DAY_MS = 86_400_000;

// Counted from calendar dates, so a daylight-saving change never shortens a day.
export function dayIndex(date: string): number {
	const d = parseLocalDate(date);
	return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function dateFromDayIndex(index: number): string {
	const d = new Date(index * DAY_MS);
	return formatDateString(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dateInMonth(year: number, month: number, day: number): string {
	const clamped = Math.min(day, getDaysInMonth(year, month));
	return formatDateString(new Date(year, month - 1, clamped));
}

function firstOfNextMonth(today: string): string {
	const d = parseLocalDate(today);
	return formatDateString(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

// Biweekly pay lands on the same weekday every time; semi-monthly pay follows dates instead.
function sameWeekday(indexes: number[]): boolean {
	const counts = new Map<number, number>();
	for (const index of indexes) {
		const weekday = ((index % 7) + 7) % 7;
		counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
	}
	return Math.max(...Array.from(counts.values())) / indexes.length >= 0.75;
}

function nextMonthlyDate(lastDate: string, todayIndex: number, days: number[]): string {
	const last = parseLocalDate(lastDate);
	const lastIndex = dayIndex(lastDate);
	for (let offset = 0; offset < 24; offset++) {
		const year = last.getFullYear() + Math.floor((last.getMonth() + offset) / 12);
		const month = ((last.getMonth() + offset) % 12) + 1;
		for (const day of days) {
			const candidate = dateInMonth(year, month, day);
			const index = dayIndex(candidate);
			if (index > lastIndex && index >= todayIndex) return candidate;
		}
	}
	return dateFromDayIndex(todayIndex + 30);
}

/**
 * When the next regular income is due, read from the income the user has recorded. Every
 * deposit counts as income elsewhere; here only the regular-sized ones set the rhythm, so a
 * one-off sale does not throw off the schedule.
 */
export function inferPaySchedule(deposits: IncomeDeposit[], today: string): PaySchedule {
	const todayIndex = dayIndex(today);
	const fallback: PaySchedule = { cadence: null, nextPayday: firstOfNextMonth(today) };

	const recent = deposits
		.filter((deposit) => deposit.amount > 0)
		.map((deposit) => ({ date: deposit.date.slice(0, 10), index: dayIndex(deposit.date), amount: deposit.amount }))
		.filter((deposit) => deposit.index <= todayIndex && deposit.index > todayIndex - INCOME_LOOKBACK_DAYS);
	if (recent.length < 3) return fallback;

	const typical = median(
		recent
			.map((deposit) => deposit.amount)
			.sort((a, b) => b - a)
			.slice(0, 6)
	);

	const byDay = new Map<number, string>();
	for (const deposit of recent) {
		if (deposit.amount >= typical * 0.5 && deposit.amount <= typical * 2) byDay.set(deposit.index, deposit.date);
	}
	const regular = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]);
	if (regular.length < 3) return fallback;

	const gaps = regular.slice(1).map(([index], i) => index - regular[i][0]);
	const gap = median(gaps);
	const [lastIndex, lastDate] = regular[regular.length - 1];

	// Pay due today but not yet recorded still makes today the next payday.
	const nextBySteps = (step: number) =>
		dateFromDayIndex(lastIndex + step * Math.max(1, Math.ceil((todayIndex - lastIndex) / step)));

	if (gap >= 6 && gap <= 8) return { cadence: "weekly", nextPayday: nextBySteps(7) };
	if (gap >= 13 && gap <= 17) {
		if (sameWeekday(regular.map(([index]) => index))) return { cadence: "biweekly", nextPayday: nextBySteps(14) };
		const days = regular
			.slice(-2)
			.map(([, date]) => parseLocalDate(date).getDate())
			.sort((a, b) => a - b);
		return { cadence: "semimonthly", nextPayday: nextMonthlyDate(lastDate, todayIndex, days) };
	}
	if (gap >= 28 && gap <= 33) {
		return {
			cadence: "monthly",
			nextPayday: nextMonthlyDate(lastDate, todayIndex, [parseLocalDate(lastDate).getDate()]),
		};
	}
	return fallback;
}
