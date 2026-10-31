import { calculateNextDueDate, formatDateString, parseLocalDate, stepDate } from "@/lib/date-utils";

export type FeeKind = "overdraft" | "nsf" | "over_limit";

export const FEE_LABELS: Record<FeeKind, string> = {
	overdraft: "Overdraft fee",
	nsf: "NSF fee",
	over_limit: "Over-limit fee",
};

/** How far ahead the account and Recurring pages look for a payment that would charge a fee. */
export const FEE_WARNING_DAYS = 30;

export interface FeeTerms {
	current_balance: number;
	credit_limit: number | null;
	overdraft_protection?: boolean | null;
	overdraft_limit?: number | null;
	overdraft_fee?: number | null;
	nsf_fee?: number | null;
	over_limit_fee?: number | null;
	account_type?: { class?: string | null } | null;
}

export interface Fee {
	kind: FeeKind;
	/** What the bank charges, always positive. */
	amount: number;
}

export interface ScheduledPayment {
	recurringId: string;
	name: string;
	/** YYYY-MM-DD */
	date: string;
	/** Positive amount the payment takes. */
	amount: number;
}

export interface ProjectedFee extends Fee {
	recurringId: string;
	paymentName: string;
	date: string;
}

const toCents = (value: number | string | null | undefined) => Math.round(Number(value ?? 0) * 100);

/** Whether the account has any fee set, so callers can skip accounts with nothing to project. */
export function hasFeeTerms(account: FeeTerms): boolean {
	return [account.overdraft_fee, account.nsf_fee, account.over_limit_fee].some((fee) => Number(fee) > 0);
}

/**
 * The fee a payment charges when it moves the balance to `balance`. Mirrors post_account_fee()
 * (migration 012): an asset below zero pays the overdraft fee while within its protected overdraft
 * and the NSF fee past it, or with no protection; a liability whose debt is past its credit limit
 * pays the over-limit fee.
 */
export function feeForBalance(account: FeeTerms, balance: number): Fee | null {
	const cents = toCents(balance);
	let kind: FeeKind;
	let fee: number | null | undefined;

	if (account.account_type?.class === "liability") {
		if (account.credit_limit == null || cents <= toCents(account.credit_limit)) return null;
		kind = "over_limit";
		fee = account.over_limit_fee;
	} else {
		if (cents >= 0) return null;
		const withinOverdraft = !!account.overdraft_protection && cents >= -toCents(account.overdraft_limit);
		kind = withinOverdraft ? "overdraft" : "nsf";
		fee = withinOverdraft ? account.overdraft_fee : account.nsf_fee;
	}

	const feeCents = toCents(fee);
	return feeCents > 0 ? { kind, amount: feeCents / 100 } : null;
}

/** Each fee the payments would charge, posted in date order from the current balance. */
export function projectAccountFees(account: FeeTerms, payments: ScheduledPayment[]): ProjectedFee[] {
	const isLiability = account.account_type?.class === "liability";
	const direction = isLiability ? 1 : -1;
	let cents = toCents(account.current_balance);
	const fees: ProjectedFee[] = [];

	const ordered = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
	for (const payment of ordered) {
		cents += direction * toCents(Math.abs(payment.amount));
		const fee = feeForBalance(account, cents / 100);
		if (!fee) continue;
		cents += direction * toCents(fee.amount);
		fees.push({ ...fee, recurringId: payment.recurringId, paymentName: payment.name, date: payment.date });
	}
	return fees;
}

/** Every payment of the items due on or before `until` (YYYY-MM-DD), including overdue ones. */
export function scheduledPayments(
	items: { id: string; name: string; amount: number; next_due_date: string; billing_period: string }[],
	until: string
): ScheduledPayment[] {
	const payments: ScheduledPayment[] = [];
	for (const item of items) {
		let cursor = parseLocalDate(item.next_due_date.slice(0, 10));
		// A year of daily payments is the most any window here needs.
		for (let i = 0; i < 366; i++) {
			const date = formatDateString(cursor);
			if (date > until) break;
			payments.push({ recurringId: item.id, name: item.name, date, amount: Number(item.amount) });
			cursor = calculateNextDueDate(cursor, item.billing_period);
		}
	}
	return payments;
}

/** The last day of the warning window that starts `today`. */
export function feeWarningUntil(today: string, days = FEE_WARNING_DAYS): string {
	return formatDateString(stepDate(parseLocalDate(today), days, "days", 1));
}

/**
 * One month of overdraft interest on a negative balance, as a negative ledger amount rounded to
 * cents. `annualRate` is a fraction (0.21 for 21%). Zero when the balance is not below zero.
 */
export function overdraftInterest(balance: number, annualRate: number | null | undefined): number {
	const cents = toCents(balance);
	if (cents >= 0 || !annualRate || annualRate <= 0) return 0;
	return -Math.round((-cents * Number(annualRate)) / 12) / 100;
}

/**
 * The first fee each recurring item would charge in the window, by item id. Walks every account's
 * linked active items together, so a bill that lands after another one has the lower balance.
 */
export function projectedFeesByRecurring(
	items: {
		id: string;
		name: string;
		amount: number;
		next_due_date: string;
		billing_period: string;
		account_id?: string | null;
		is_active?: boolean | null;
	}[],
	accounts: (FeeTerms & { id: string })[],
	until: string
): Map<string, ProjectedFee> {
	const byItem = new Map<string, ProjectedFee>();
	for (const account of accounts) {
		if (!hasFeeTerms(account)) continue;
		const linked = items.filter((item) => item.account_id === account.id && item.is_active !== false);
		if (linked.length === 0) continue;
		for (const fee of projectAccountFees(account, scheduledPayments(linked, until))) {
			if (!byItem.has(fee.recurringId)) byItem.set(fee.recurringId, fee);
		}
	}
	return byItem;
}

/** "Phone on Nov 5 will overdraw Chequing ($45.00 NSF fee)". */
export function projectedFeeText(
	fee: ProjectedFee,
	{
		account,
		money,
		date,
		subject = fee.paymentName,
	}: { account: string; money: (amount: number) => string; date: (date: string) => string; subject?: string }
): string {
	const effect = fee.kind === "over_limit" ? `put ${account} past its limit` : `overdraw ${account}`;
	const label = fee.kind === "nsf" ? FEE_LABELS.nsf : FEE_LABELS[fee.kind].toLowerCase();
	return `${subject} on ${date(fee.date)} will ${effect} (${money(fee.amount)} ${label})`;
}
