/** Days from statement close to due date when the card has no statement day (Canada's minimum grace period). */
export const DEFAULT_GRACE_DAYS = 21;

export interface StatementLedgerRow {
	/** Signed like the ledger: a charge is positive, a payment or credit negative. */
	amount: number;
	transaction_date: string;
}

export interface StatementCycle {
	closeDate: string;
	dueDate: string;
}

export interface CardStatement extends StatementCycle {
	/** What was owed when the statement closed; negative is a credit. */
	statementBalance: number;
	/** Payments and credits dated after the close, up to the due date. */
	paidSinceClose: number;
	/** What is still due on this statement. */
	remainingDue: number;
	paidInFull: boolean;
}

export interface CardCycleSettings {
	/** Day of the month the payment is due, 1–31. */
	dueDay: number | null | undefined;
	/** Day of the month the statement closes, 1–31; unset means DEFAULT_GRACE_DAYS before the due date. */
	statementDay?: number | null;
}

const MS_PER_DAY = 86_400_000;

function toUtcDay(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

function toDateString(utcMs: number): string {
	return new Date(utcMs).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
	return toDateString(toUtcDay(date) + days * MS_PER_DAY);
}

const toCents = (amount: number) => Math.round(Number(amount) * 100);

/**
 * How far back the ledger must reach to work out the latest statement: its close is at most a
 * month before the previous due date, which is at most a month before today.
 */
const STATEMENT_LOOKBACK_DAYS = 70;

/** The first date of ledger to load to work out the latest statement as of `today`. */
export function statementLedgerSince(today: string): string {
	return addDays(today, -STATEMENT_LOOKBACK_DAYS);
}

function isMonthDay(day: number | null | undefined): day is number {
	return typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 31;
}

/** `day` in the given month; short months clamp to their last day. */
function onMonthDay(year: number, monthIndex: number, day: number): number {
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	return Date.UTC(year, monthIndex, Math.min(day, lastDay));
}

/** The latest date on or before `date` that falls on `day`. */
export function monthlyDayOnOrBefore(day: number, date: string): string {
	const [y, m] = date.split("-").map(Number);
	const thisMonth = onMonthDay(y, m - 1, day);
	return toDateString(thisMonth <= toUtcDay(date) ? thisMonth : onMonthDay(y, m - 2, day));
}

/** The earliest date on or after `date` that falls on `day`. */
export function monthlyDayOnOrAfter(day: number, date: string): string {
	const [y, m] = date.split("-").map(Number);
	const thisMonth = onMonthDay(y, m - 1, day);
	return toDateString(thisMonth >= toUtcDay(date) ? thisMonth : onMonthDay(y, m, day));
}

/** When the statement paid on `dueDate` closed. */
export function statementCloseDate(dueDate: string, statementDay?: number | null): string {
	if (!isMonthDay(statementDay)) return addDays(dueDate, -DEFAULT_GRACE_DAYS);
	return monthlyDayOnOrBefore(statementDay, addDays(dueDate, -1));
}

/** The most recent statement closed on or before `today`, with the due date that pays it. */
export function latestClosedCycle({ dueDay, statementDay }: CardCycleSettings, today: string): StatementCycle | null {
	if (!isMonthDay(dueDay)) return null;
	let dueDate = monthlyDayOnOrAfter(dueDay, today);
	let closeDate = statementCloseDate(dueDate, statementDay);
	if (closeDate > today) {
		dueDate = monthlyDayOnOrBefore(dueDay, addDays(dueDate, -1));
		closeDate = statementCloseDate(dueDate, statementDay);
	}
	return { closeDate, dueDate };
}

/** The most recent statement whose due date fell before `date`, so its grace period is over. */
export function lastEndedCycle({ dueDay, statementDay }: CardCycleSettings, date: string): StatementCycle | null {
	if (!isMonthDay(dueDay)) return null;
	const dueDate = monthlyDayOnOrBefore(dueDay, addDays(date, -1));
	return { closeDate: statementCloseDate(dueDate, statementDay), dueDate };
}

/**
 * A statement worked back from today's balance: what was owed at the close is the current
 * balance less every ledger row dated after it. `rows` must hold every row dated after the close.
 */
export function cardStatement(
	currentBalance: number,
	rows: StatementLedgerRow[],
	cycle: StatementCycle
): CardStatement {
	let sinceClose = 0;
	let paid = 0;
	for (const row of rows) {
		if (row.transaction_date <= cycle.closeDate) continue;
		const cents = toCents(row.amount);
		sinceClose += cents;
		if (cents < 0 && row.transaction_date <= cycle.dueDate) paid -= cents;
	}
	const statementCents = toCents(currentBalance) - sinceClose;
	const remainingCents = Math.max(0, statementCents - paid);

	return {
		...cycle,
		statementBalance: statementCents / 100,
		paidSinceClose: paid / 100,
		remainingDue: remainingCents / 100,
		paidInFull: remainingCents === 0,
	};
}

/**
 * Whether the monthly interest run on `runDate` skips this card: true when the last statement
 * whose due date has passed was paid in full by that date. A card with no due day never skips.
 */
export function isCardInterestWaived(
	settings: CardCycleSettings,
	currentBalance: number,
	rows: StatementLedgerRow[],
	runDate: string
): boolean {
	const cycle = lastEndedCycle(settings, runDate);
	return cycle !== null && cardStatement(currentBalance, rows, cycle).paidInFull;
}
