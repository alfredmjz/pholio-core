/**
 * Figures and alerts for the Accounts page: credit utilization, each account's progress line,
 * the heads-up list, and the points for a balance sparkline.
 *
 * Behaviour follows the account type's `code` and the fields the account has, never its name.
 */

import { differenceInDays, formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { buildHeadsUp, type HeadsUpPromotion } from "@/app/dashboard/heads-up";
import type { AccountWithType } from "./types";

/** Above this share of a credit limit, utilization starts to weigh on a credit score. */
export const UTILIZATION_ALERT = 0.3;
/** How far ahead a card or loan payment counts as "due soon". */
export const PAYMENT_DUE_WINDOW_DAYS = 7;
export const ACCOUNT_ALERT_LIMIT = 4;

export interface CreditUtilization {
	used: number;
	limit: number;
	/** 0-100, or null when no account has a credit limit. */
	percent: number | null;
}

/** Combined balance owed against combined credit limits, across liabilities that have a limit. */
export function creditUtilization(accounts: AccountWithType[]): CreditUtilization {
	let used = 0;
	let limit = 0;
	for (const account of accounts) {
		if (account.account_type?.class !== "liability" || !account.credit_limit || account.credit_limit <= 0) continue;
		used += Math.max(0, Number(account.current_balance));
		limit += Number(account.credit_limit);
	}
	return { used, limit, percent: limit > 0 ? (used / limit) * 100 : null };
}

export interface AccountProgress {
	/** e.g. "85% of goal", "16% of limit used", "26% paid off" */
	label: string;
	/** 0-100, capped for drawing. */
	percent: number;
	tone: "positive" | "caution" | "neutral";
}

/** The one progress line an account shows: toward a savings goal, against a limit, or paid off. */
export function accountProgress(account: AccountWithType): AccountProgress | null {
	const balance = Number(account.current_balance);
	if (account.account_type?.class === "asset") {
		if (!account.target_balance || account.target_balance <= 0) return null;
		const percent = (balance / account.target_balance) * 100;
		return { label: `${Math.round(percent)}% of goal`, percent: Math.min(100, Math.max(0, percent)), tone: "positive" };
	}
	if (account.credit_limit && account.credit_limit > 0) {
		const percent = (balance / account.credit_limit) * 100;
		return {
			label: `${Math.round(percent)}% of limit used`,
			percent: Math.min(100, Math.max(0, percent)),
			tone: percent >= UTILIZATION_ALERT * 100 ? "caution" : "neutral",
		};
	}
	if (account.original_amount && account.original_amount > 0) {
		const percent = ((account.original_amount - balance) / account.original_amount) * 100;
		return {
			label: `${Math.round(percent)}% paid off`,
			percent: Math.min(100, Math.max(0, percent)),
			tone: "positive",
		};
	}
	return null;
}

export type AccountAlertKind = "payment_due" | "high_utilization" | "promotion" | "goal_reached";

export interface AccountAlert {
	id: string;
	kind: AccountAlertKind;
	title: string;
	detail: string;
	href: string;
}

/** The next date a monthly due day falls on, from today (YYYY-MM-DD). */
export function nextDueDate(dueDay: number, today: string): string {
	const now = parseLocalDate(today);
	const clamp = (year: number, month: number) => Math.min(dueDay, new Date(year, month + 1, 0).getDate());
	let year = now.getFullYear();
	let month = now.getMonth();
	if (clamp(year, month) < now.getDate()) {
		month += 1;
		if (month > 11) {
			month = 0;
			year += 1;
		}
	}
	const day = clamp(year, month);
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dueIn(days: number) {
	if (days <= 0) return "today";
	if (days === 1) return "tomorrow";
	return `in ${days} days`;
}

/**
 * Things worth acting on, most urgent first: payments due within a week, cards over 30% of
 * their limit, promotions ending within 30 days, then goals reached.
 */
export function buildAccountAlerts({
	accounts,
	today,
	promotions = [],
	limit = ACCOUNT_ALERT_LIMIT,
}: {
	accounts: AccountWithType[];
	today: string;
	promotions?: HeadsUpPromotion[];
	limit?: number;
}): AccountAlert[] {
	const href = (account: AccountWithType) => `/accounts/${account.id}`;

	const paymentsDue: AccountAlert[] = accounts
		.filter((a) => a.account_type?.class === "liability" && a.payment_due_date && Number(a.current_balance) > 0)
		.map((account) => {
			const date = nextDueDate(account.payment_due_date as number, today);
			return { account, date, days: differenceInDays(parseLocalDate(date), parseLocalDate(today)) };
		})
		.filter(({ days }) => days <= PAYMENT_DUE_WINDOW_DAYS)
		.sort((a, b) => a.days - b.days)
		.map(({ account, date, days }) => ({
			id: `due-${account.id}`,
			kind: "payment_due",
			title: `${account.name} payment due ${dueIn(days)}`,
			detail: `${formatShortDate(date)}, ${formatCurrency(Number(account.current_balance), { showCents: true })} owing`,
			href: href(account),
		}));

	const highUtilization: AccountAlert[] = accounts
		.filter(
			(a) =>
				a.account_type?.class === "liability" &&
				a.credit_limit &&
				a.credit_limit > 0 &&
				Number(a.current_balance) / a.credit_limit >= UTILIZATION_ALERT
		)
		.sort(
			(a, b) =>
				Number(b.current_balance) / (b.credit_limit as number) - Number(a.current_balance) / (a.credit_limit as number)
		)
		.map((account) => ({
			id: `utilization-${account.id}`,
			kind: "high_utilization",
			title: `${account.name} is at ${Math.round((Number(account.current_balance) / (account.credit_limit as number)) * 100)}% of its limit`,
			detail: "Keeping cards under 30% of their limit helps your credit score",
			href: href(account),
		}));

	const promotionsEnding: AccountAlert[] = buildHeadsUp({
		today,
		bills: [],
		categories: [],
		promotions,
		limit: 99,
	}).map((item) => ({ id: item.id, kind: "promotion", title: item.title, detail: item.detail, href: item.href }));

	const goalsReached: AccountAlert[] = accounts
		.filter(
			(a) =>
				a.account_type?.class === "asset" &&
				a.target_balance &&
				a.target_balance > 0 &&
				Number(a.current_balance) >= a.target_balance
		)
		.map((account) => ({
			id: `goal-${account.id}`,
			kind: "goal_reached",
			title: `${account.name} reached its goal`,
			detail: `${formatCurrency(Number(account.current_balance))} saved toward ${formatCurrency(account.target_balance as number)}`,
			href: href(account),
		}));

	return [...paymentsDue, ...highUtilization, ...promotionsEnding, ...goalsReached].slice(0, limit);
}

export interface BalancePoint {
	/** YYYY-MM-DD */
	date: string;
	balance: number;
}

/**
 * Points for a balance sparkline: recorded history in date order, ending on the current balance
 * so the line always finishes on the figure shown beside it. Fewer than two points means there
 * is nothing to draw.
 */
export function sparklinePoints(history: BalancePoint[], currentBalance: number, today: string): BalancePoint[] {
	const sorted = history.filter((p) => p.date < today).sort((a, b) => a.date.localeCompare(b.date));
	return [...sorted, { date: today, balance: Number(currentBalance) }];
}
