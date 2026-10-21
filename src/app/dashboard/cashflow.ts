/**
 * Monthly income and spending for the cash flow chart.
 *
 * Transfers between the user's own accounts move money without earning or spending it, so they
 * are left out. A transfer is identified by `source === "transfer"` (set when the transfer is
 * created), never by its name.
 */

import { parseLocalDate } from "@/lib/date-utils";

export interface CashflowTransaction {
	/** YYYY-MM-DD (an ISO timestamp is accepted; only the date part is read). */
	date: string;
	/** Positive for money in, negative for money out. */
	amount: number;
	source?: string | null;
}

export interface CashflowMonth {
	/** YYYY-MM */
	key: string;
	/** Short month name, e.g. "Oct". */
	label: string;
	income: number;
	expenses: number;
	net: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function roundCents(value: number): number {
	return Math.round(value * 100) / 100;
}

export function isTransfer(transaction: { source?: string | null }): boolean {
	return transaction.source === "transfer";
}

/** The first day of the oldest month in the window, as YYYY-MM-DD. */
export function cashflowWindowStart(today: string, months: number): string {
	const date = parseLocalDate(today);
	const start = new Date(date.getFullYear(), date.getMonth() - (months - 1), 1);
	return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * One bucket per month for the last `months` months, ending with the current month. Months
 * with no transactions are still returned (as zeros) so the chart's time axis stays even.
 */
export function buildMonthlyCashflow(
	transactions: CashflowTransaction[],
	today: string,
	months: number = 6
): CashflowMonth[] {
	const now = parseLocalDate(today);
	const buckets: CashflowMonth[] = [];
	const index = new Map<string, CashflowMonth>();

	for (let offset = months - 1; offset >= 0; offset--) {
		const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const bucket = { key, label: MONTH_LABELS[d.getMonth()], income: 0, expenses: 0, net: 0 };
		buckets.push(bucket);
		index.set(key, bucket);
	}

	for (const transaction of transactions) {
		if (isTransfer(transaction)) continue;
		const bucket = index.get(transaction.date.slice(0, 7));
		if (!bucket) continue;
		const amount = Number(transaction.amount);
		if (amount > 0) bucket.income += amount;
		else bucket.expenses += Math.abs(amount);
	}

	for (const bucket of buckets) {
		bucket.income = roundCents(bucket.income);
		bucket.expenses = roundCents(bucket.expenses);
		bucket.net = roundCents(bucket.income - bucket.expenses);
	}

	return buckets;
}
