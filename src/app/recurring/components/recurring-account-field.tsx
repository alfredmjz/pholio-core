"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
import type { AccountWithType } from "@/app/accounts/types";

import { canPayBillsFrom, canPayDown, NO_ACCOUNT } from "./recurring-form";

export { NO_ACCOUNT };

interface RecurringAccountFieldProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	accounts: AccountWithType[];
}

/**
 * "Paid from" picker for a bill or subscription. "No account" stays first (ADR-003). Mortgages and
 * loans are left out, except one an older item already uses.
 */
export function RecurringAccountField({ id, value, onChange, accounts }: RecurringAccountFieldProps) {
	const options = accounts.filter((account) => canPayBillsFrom(account) || account.id === value);
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>Paid from</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id={id} className="h-10">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NO_ACCOUNT}>No account</SelectItem>
					{sortAccounts(options).map((account) => (
						<SelectItem key={account.id} value={account.id}>
							{formatAccountDisplayName(account)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="type-body-xs text-muted-foreground">
				{value === NO_ACCOUNT
					? "Payments only go to your budget."
					: "Every payment is also recorded on this account and linked to it, so editing or deleting one updates both."}
			</p>
		</div>
	);
}

interface RecurringDebtFieldProps {
	id: string;
	/** The debt's account id, or "" for none. */
	value: string;
	onChange: (value: string) => void;
	/** The paid-from account, left out of the list. */
	paidFromId: string;
	accounts: AccountWithType[];
}

/** "Pays down" picker for a bill: the card, line of credit, loan or mortgage each payment lowers. */
export function RecurringDebtField({ id, value, onChange, paidFromId, accounts }: RecurringDebtFieldProps) {
	const options = accounts.filter((account) => canPayDown(account) && account.id !== paidFromId);
	const debt = accounts.find((account) => account.id === value);
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>Pays down</Label>
			<Select value={value || NO_ACCOUNT} onValueChange={(next) => onChange(next === NO_ACCOUNT ? "" : next)}>
				<SelectTrigger id={id} className="h-10">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NO_ACCOUNT}>Nothing</SelectItem>
					{sortAccounts(options).map((account) => (
						<SelectItem key={account.id} value={account.id}>
							{formatAccountDisplayName(account)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="type-body-xs text-muted-foreground">
				{debt
					? `Each payment lowers what you owe on ${debt.name} and still counts in your budget.`
					: "Pick a mortgage, loan, line of credit or card if this bill pays one off."}
			</p>
		</div>
	);
}
