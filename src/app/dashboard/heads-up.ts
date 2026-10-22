/**
 * The short "heads up" list and the "coming up" bill list.
 *
 * Heads up surfaces only things the user can act on now, most urgent first: bills already past
 * due (combined into one item when there are several), budget categories already over their cap, then promotions whose deadline is close and
 * that are not yet met. Everything else stays on its own page.
 */

import { differenceInDays, formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";

export type HeadsUpKind = "overdue_bill" | "over_budget" | "promotion";

export interface HeadsUpItem {
	id: string;
	kind: HeadsUpKind;
	title: string;
	detail: string;
	href: string;
}

export interface HeadsUpPromotion {
	id: string;
	accountId: string;
	accountName: string;
	type: "spend_threshold" | "deposit_threshold" | "maintaining_balance";
	target: number;
	current: number;
	reward: string;
	/** YYYY-MM-DD */
	endDate: string;
	isCompleted: boolean;
}

export interface HeadsUpCategory {
	id: string;
	name: string;
	budget: number;
	spent: number;
}

export type BillStatus = "paid" | "partial" | "unpaid" | "overpaid" | "upcoming" | "overdue" | "due_today";

export interface BillInput {
	id: string;
	name: string;
	amount: number;
	/** YYYY-MM-DD or ISO timestamp */
	dueDate: string;
	status?: BillStatus;
	isActive?: boolean | null;
	serviceProvider?: string | null;
}

export interface UpcomingBill {
	id: string;
	name: string;
	amount: number;
	/** YYYY-MM-DD */
	dueDate: string;
	/** Negative when overdue, 0 when due today. */
	daysUntil: number;
	serviceProvider: string | null;
}

/** How far ahead "coming up" looks. */
export const UPCOMING_WINDOW_DAYS = 14;
/** Promotions ending within this many days are worth a heads up. */
export const PROMOTION_WINDOW_DAYS = 30;
export const HEADS_UP_LIMIT = 3;

const SETTLED: BillStatus[] = ["paid", "overpaid"];

function daysBetween(from: string, to: string): number {
	return differenceInDays(parseLocalDate(to), parseLocalDate(from));
}

function isOpenBill(bill: BillInput): boolean {
	return bill.isActive !== false && !SETTLED.includes(bill.status ?? "upcoming");
}

/** Unpaid bills due from the past through the next `windowDays` days, soonest first. */
export function selectUpcomingBills(
	bills: BillInput[],
	today: string,
	windowDays: number = UPCOMING_WINDOW_DAYS
): UpcomingBill[] {
	return bills
		.filter(isOpenBill)
		.map((bill) => {
			const dueDate = bill.dueDate.slice(0, 10);
			return {
				id: bill.id,
				name: bill.name,
				amount: Number(bill.amount),
				dueDate,
				daysUntil: daysBetween(today, dueDate),
				serviceProvider: bill.serviceProvider ?? null,
			};
		})
		.filter((bill) => bill.daysUntil <= windowDays)
		.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

function daysLeftLabel(days: number): string {
	if (days <= 0) return "ends today";
	if (days === 1) return "1 day left";
	return `${days} days left`;
}

function promotionItem(promotion: HeadsUpPromotion, today: string): HeadsUpItem {
	const left = Math.max(0, promotion.target - promotion.current);
	const amount = formatCurrency(left);
	const deadline = `by ${formatShortDate(promotion.endDate)}, ${daysLeftLabel(daysBetween(today, promotion.endDate))}`;

	let title: string;
	let detail = `${deadline}, for ${promotion.reward}`;
	if (promotion.type === "spend_threshold") title = `Spend ${amount} more on ${promotion.accountName}`;
	else if (promotion.type === "deposit_threshold") title = `Deposit ${amount} more into ${promotion.accountName}`;
	else {
		// Maintaining-balance progress is the current balance, so being short means topping up.
		title = `Add ${amount} to ${promotion.accountName}`;
		detail = `to hold ${formatCurrency(promotion.target)} ${detail}`;
	}

	return {
		id: `promotion-${promotion.id}`,
		kind: "promotion",
		title,
		detail,
		href: `/accounts/${promotion.accountId}`,
	};
}

export function buildHeadsUp({
	today,
	bills,
	categories,
	promotions,
	limit = HEADS_UP_LIMIT,
}: {
	today: string;
	bills: BillInput[];
	categories: HeadsUpCategory[];
	promotions: HeadsUpPromotion[];
	limit?: number;
}): HeadsUpItem[] {
	const overdueBills = selectUpcomingBills(bills, today).filter((bill) => bill.daysUntil < 0);
	const overdue: HeadsUpItem[] = [];
	if (overdueBills.length === 1) {
		const [bill] = overdueBills;
		overdue.push({
			id: `bill-${bill.id}`,
			kind: "overdue_bill",
			title: `${bill.name} is overdue`,
			detail: `${formatCurrency(bill.amount, { showCents: true })} was due ${formatShortDate(bill.dueDate)}`,
			href: "/recurring",
		});
	} else if (overdueBills.length > 1) {
		// One item for all of them: the "coming up" list already shows each bill.
		const total = overdueBills.reduce((sum, bill) => sum + bill.amount, 0);
		overdue.push({
			id: "bills-overdue",
			kind: "overdue_bill",
			title: `${overdueBills.length} bills are overdue`,
			detail: `${formatCurrency(total, { showCents: true })} in total, oldest due ${formatShortDate(overdueBills[0].dueDate)}`,
			href: "/recurring",
		});
	}

	const overBudget: HeadsUpItem[] = categories
		.filter((category) => category.budget > 0 && category.spent > category.budget)
		.sort((a, b) => b.spent - b.budget - (a.spent - a.budget))
		.map((category) => ({
			id: `category-${category.id}`,
			kind: "over_budget",
			title: `${category.name} is over budget`,
			detail: `${formatCurrency(category.spent - category.budget)} over its ${formatCurrency(category.budget)} budget`,
			href: "/allocations",
		}));

	const promotionsDue: HeadsUpItem[] = promotions
		.filter((promotion) => {
			if (promotion.isCompleted || promotion.current >= promotion.target) return false;
			const days = daysBetween(today, promotion.endDate);
			return days >= 0 && days <= PROMOTION_WINDOW_DAYS;
		})
		.sort((a, b) => a.endDate.localeCompare(b.endDate))
		.map((promotion) => promotionItem(promotion, today));

	return [...overdue, ...overBudget, ...promotionsDue].slice(0, limit);
}
