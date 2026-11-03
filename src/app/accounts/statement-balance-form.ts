// Pure helpers for the card statement balance field of the Add/Edit Account dialogs, kept free of
// React so they can be unit tested. A typed statement balance belongs to the latest statement
// closed before today, worked out from the due and close days in the same form.

import { latestClosedCycle, type StatementCycle } from "@/lib/credit-card-statement";
import { formatShortDate } from "@/lib/date-utils";
import type { CreateAccountInput } from "./types";

export type StatementBalanceInput = Pick<CreateAccountInput, "statement_balance" | "statement_balance_date">;

const toDay = (value: string) => (value.trim() ? parseInt(value, 10) : null);

/** The statement a balance typed today belongs to; null until the form has a due day. */
export function statementForEntry(dueDay: string, statementDay: string, today: string): StatementCycle | null {
	return latestClosedCycle({ dueDay: toDay(dueDay), statementDay: toDay(statementDay) }, today);
}

export function statementBalanceHint(cycle: StatementCycle | null): string {
	if (!cycle) return "Add the payment due day to match this to a statement.";
	return `From the statement that closed ${formatShortDate(cycle.closeDate)}, due ${formatShortDate(cycle.dueDate)}.`;
}

/** A new card's statement balance; blank leaves it to be worked out from the current balance. */
export function toStatementBalanceInput(value: string, cycle: StatementCycle | null): StatementBalanceInput {
	const amount = parseFloat(value);
	if (!cycle || !Number.isFinite(amount)) return {};
	return { statement_balance: amount, statement_balance_date: cycle.closeDate };
}

/**
 * What the Edit dialog saves for the statement balance. `initial` is the balance shown when the
 * dialog opened, for the statement that closed on `initialCloseDate`.
 */
export function statementBalanceUpdate({
	value,
	initial,
	initialCloseDate,
	cycle,
	balanceChanged,
}: {
	value: string;
	initial: string;
	initialCloseDate: string | null;
	cycle: StatementCycle | null;
	balanceChanged: boolean;
}): StatementBalanceInput {
	const edited = value.trim() !== initial.trim();
	if (edited && !value.trim()) return { statement_balance: null, statement_balance_date: null };
	// Typing over the current balance moves a statement worked back from it, so keep the one shown.
	const keepShown = balanceChanged && cycle !== null && cycle.closeDate === initialCloseDate;
	return edited || keepShown ? toStatementBalanceInput(value, cycle) : {};
}
