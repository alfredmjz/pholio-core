/**
 * Net worth over time, rebuilt from per-account balance history.
 *
 * `account_history` stores one balance per account per day it changed. To get net worth on a
 * given day we need every account's balance on that day, so each account carries its last
 * recorded balance forward. Before an account's first record we assume it held that first
 * balance (flat backfill): accounts are often added to Pholio long after they were opened, and
 * counting them as zero would draw a jump in net worth that never happened. Accounts with no
 * history at all count at their current balance for the whole period.
 */

import { parseLocalDate } from "@/lib/date-utils";

export type BalanceClass = "asset" | "liability";

export interface BalanceAccount {
	id: string;
	class: BalanceClass;
	/** Current balance. Liabilities are stored as a positive amount owed. */
	balance: number;
}

export interface BalanceRecord {
	accountId: string;
	balance: number;
	/** YYYY-MM-DD */
	date: string;
}

export interface NetWorthPoint {
	/** YYYY-MM-DD */
	date: string;
	value: number;
	assets: number;
	liabilities: number;
}

export type NetWorthRange = "1M" | "3M" | "6M" | "1Y";

export const NET_WORTH_RANGES: NetWorthRange[] = ["1M", "3M", "6M", "1Y"];

const RANGE_MONTHS: Record<NetWorthRange, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };

function roundCents(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * One point per date on which any balance was recorded, plus a final point for `today` that
 * uses current balances so the line always ends on what the balance sheet shows.
 */
export function buildNetWorthSeries(
	accounts: BalanceAccount[],
	records: BalanceRecord[],
	today: string
): NetWorthPoint[] {
	const known = new Set(accounts.map((a) => a.id));
	const byAccount = new Map<string, BalanceRecord[]>();
	for (const record of records) {
		if (!known.has(record.accountId) || record.date > today) continue;
		const list = byAccount.get(record.accountId) ?? [];
		list.push(record);
		byAccount.set(record.accountId, list);
	}
	byAccount.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));

	const dates = Array.from(
		new Set(records.filter((r) => known.has(r.accountId) && r.date < today).map((r) => r.date))
	).sort();

	// Walk the dates in order with one cursor per account.
	const cursors = new Map<string, number>();
	const balanceOn = (account: BalanceAccount, date: string): number => {
		const list = byAccount.get(account.id);
		if (!list || list.length === 0) return Number(account.balance);
		let index = cursors.get(account.id) ?? -1;
		while (index + 1 < list.length && list[index + 1].date <= date) index++;
		cursors.set(account.id, index);
		return Number(index === -1 ? list[0].balance : list[index].balance);
	};

	const pointFor = (date: string, balance: (account: BalanceAccount) => number): NetWorthPoint => {
		let assets = 0;
		let liabilities = 0;
		for (const account of accounts) {
			if (account.class === "liability") liabilities += balance(account);
			else assets += balance(account);
		}
		return {
			date,
			value: roundCents(assets - liabilities),
			assets: roundCents(assets),
			liabilities: roundCents(liabilities),
		};
	};

	const points = dates.map((date) => pointFor(date, (account) => balanceOn(account, date)));
	points.push(pointFor(today, (account) => Number(account.balance)));
	return points;
}

/** The first day shown for a range, as YYYY-MM-DD. */
export function rangeStartDate(range: NetWorthRange, today: string): string {
	const date = parseLocalDate(today);
	const start = new Date(date.getFullYear(), date.getMonth() - RANGE_MONTHS[range], date.getDate());
	const y = start.getFullYear();
	const m = String(start.getMonth() + 1).padStart(2, "0");
	const d = String(start.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * The part of the series inside a range. When the range starts between two points, the value
 * in effect at the start is carried in as the first point so the line and the change both
 * begin at the range's first day rather than at whichever record happened to come next.
 */
export function sliceSeries(points: NetWorthPoint[], from: string): NetWorthPoint[] {
	const inside = points.filter((p) => p.date >= from);
	const before = points.filter((p) => p.date < from);
	if (before.length === 0 || inside[0]?.date === from) return inside;
	return [{ ...before[before.length - 1], date: from }, ...inside];
}

export interface SeriesChange {
	amount: number;
	/** Percent of the starting value, or null when the start is zero or negative. */
	percent: number | null;
}

export function seriesChange(points: NetWorthPoint[]): SeriesChange {
	if (points.length < 2) return { amount: 0, percent: null };
	const first = points[0].value;
	const last = points[points.length - 1].value;
	const amount = roundCents(last - first);
	return { amount, percent: first > 0 ? (amount / first) * 100 : null };
}
