/**
 * Schedule maths for recurring bills and subscriptions.
 *
 * `billing_period` is stored either in the current "n:unit" form ("1:months", "2:weeks") or in
 * the legacy words ("monthly", "yearly", "weekly", "biweekly"). Everything here normalises it
 * first, so a "3:months" bill is never mistaken for a monthly one.
 */

import { calculateNextDueDate, formatDateString, getDaysInMonth, parseLocalDate, stepDate } from "@/lib/date-utils";

export type PeriodUnit = "days" | "weeks" | "months" | "years";

export interface Period {
	value: number;
	unit: PeriodUnit;
}

const LEGACY: Record<string, Period> = {
	daily: { value: 1, unit: "days" },
	weekly: { value: 1, unit: "weeks" },
	biweekly: { value: 2, unit: "weeks" },
	monthly: { value: 1, unit: "months" },
	yearly: { value: 1, unit: "years" },
};

const UNIT_ALIASES: Record<string, PeriodUnit> = {
	day: "days",
	days: "days",
	daily: "days",
	week: "weeks",
	weeks: "weeks",
	weekly: "weeks",
	month: "months",
	months: "months",
	monthly: "months",
	year: "years",
	years: "years",
	yearly: "years",
};

/** Reads a stored billing period. Anything unrecognised is treated as monthly. */
export function parsePeriod(billingPeriod: string): Period {
	const raw = (billingPeriod || "").trim().toLowerCase();
	if (LEGACY[raw]) return LEGACY[raw];
	const [valuePart, unitPart] = raw.includes(":") ? raw.split(":") : ["1", raw];
	const unit = UNIT_ALIASES[unitPart];
	const value = Math.max(1, parseInt(valuePart, 10) || 1);
	return unit ? { value, unit } : { value: 1, unit: "months" };
}

/** Average days in a month and weeks in a month over a year. */
const DAYS_PER_MONTH = 365.25 / 12;
const WEEKS_PER_MONTH = 52 / 12;

/** What one item costs per month on average, e.g. a $120 yearly fee is $10 a month. */
export function monthlyEquivalent(amount: number, billingPeriod: string): number {
	const { value, unit } = parsePeriod(billingPeriod);
	const perOccurrence = Number(amount) || 0;
	switch (unit) {
		case "days":
			return (perOccurrence * DAYS_PER_MONTH) / value;
		case "weeks":
			return (perOccurrence * WEEKS_PER_MONTH) / value;
		case "years":
			return perOccurrence / (12 * value);
		default:
			return perOccurrence / value;
	}
}

/** The due date a payment settles: the one it was recorded for, else its own date (older rows). */
export function coveredDueDate(payment: { covers_due_date?: string | null; transaction_date: string }): string {
	return (payment.covers_due_date || payment.transaction_date).slice(0, 10);
}

/**
 * The payments that count toward a month: recurring ones by the due date they cover, so a bill
 * paid early counts in the month it was due; others (matched by name) by their own date.
 */
export function paymentsForMonth<
	T extends { covers_due_date?: string | null; transaction_date: string; recurring_expense_id?: string | null },
>(payments: T[], monthStart: string, monthEnd: string): T[] {
	return payments.filter((payment) => {
		const date = payment.recurring_expense_id ? coveredDueDate(payment) : payment.transaction_date.slice(0, 10);
		return date >= monthStart && date <= monthEnd;
	});
}

/** How far ahead, and how many, bills can be paid early. */
export const PAY_AHEAD_MONTHS = 12;
export const PAY_AHEAD_MAX = 24;

/**
 * The next unpaid due dates (YYYY-MM-DD), oldest first, from `nextDueDate` up to `months` after
 * today: how many bills can be paid early. Steps the same way as earlyPaymentPlan.
 */
export function upcomingOccurrences(
	nextDueDate: string,
	billingPeriod: string,
	today: string,
	months = PAY_AHEAD_MONTHS,
	max = PAY_AHEAD_MAX
): string[] {
	const horizon = formatDateString(stepDate(parseLocalDate(today), months, "months", 1));
	const dates: string[] = [];
	let cursor = parseLocalDate(nextDueDate);
	while (dates.length < max) {
		const date = formatDateString(cursor);
		if (date > horizon) break;
		dates.push(date);
		cursor = calculateNextDueDate(cursor, billingPeriod);
	}
	return dates;
}

/**
 * Which due dates paying `count` bills covers, starting at `nextDueDate`, and the due date that
 * follows them. Every 2 weeks from Jan 14, three bills cover Jan 14, Jan 28 and Feb 11; the next
 * one is due Feb 25.
 */
export function earlyPaymentPlan(
	nextDueDate: string,
	billingPeriod: string,
	count: number
): { covered: string[]; nextDue: string } {
	const covered: string[] = [];
	let cursor = parseLocalDate(nextDueDate);
	for (let i = 0; i < count; i++) {
		covered.push(formatDateString(cursor));
		cursor = calculateNextDueDate(cursor, billingPeriod);
	}
	return { covered, nextDue: formatDateString(cursor) };
}

export type OccurrenceState = "paid" | "overdue" | "due_today" | "upcoming";

export interface Occurrence {
	/** YYYY-MM-DD */
	date: string;
	state: OccurrenceState;
}

/**
 * Every due date of one item that falls in the given month, with its state.
 *
 * `nextDueDate` is the next unpaid due date (the server moves it past occurrences already paid),
 * so dates before it in the month were paid, and dates from it onward are unpaid: overdue when
 * before today, due today, or upcoming.
 */
export function occurrencesInMonth(
	nextDueDate: string,
	billingPeriod: string,
	year: number,
	month: number,
	today: string
): Occurrence[] {
	const { value, unit } = parsePeriod(billingPeriod);
	const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
	const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(getDaysInMonth(year, month)).padStart(2, "0")}`;
	const next = formatDateString(parseLocalDate(nextDueDate));

	const dates = new Set<string>();
	// Walk back from the next due date to find earlier (paid) dates in this month…
	let cursor = parseLocalDate(next);
	for (let i = 0; i < 400; i++) {
		cursor = stepDate(cursor, value, unit, -1);
		const date = formatDateString(cursor);
		if (date < monthStart) break;
		if (date <= monthEnd) dates.add(date);
	}
	// …then forward from it for the unpaid ones.
	cursor = parseLocalDate(next);
	for (let i = 0; i < 400; i++) {
		const date = formatDateString(cursor);
		if (date > monthEnd) break;
		if (date >= monthStart) dates.add(date);
		cursor = stepDate(cursor, value, unit, 1);
	}

	return Array.from(dates)
		.sort()
		.map(
			(date): Occurrence => ({
				date,
				state: date < next ? "paid" : date < today ? "overdue" : date === today ? "due_today" : "upcoming",
			})
		);
}
