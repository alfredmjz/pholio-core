"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
import type { AccountWithType } from "@/app/accounts/types";

export const NO_ACCOUNT = "__none__";

interface RecurringAccountFieldProps {
	id: string;
	value: string;
	onChange: (value: string) => void;
	accounts: AccountWithType[];
}

/** "Paid from" picker for a bill or subscription. "No account" stays first (ADR-003). */
export function RecurringAccountField({ id, value, onChange, accounts }: RecurringAccountFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>Paid from</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id={id} className="h-10">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NO_ACCOUNT}>No account</SelectItem>
					{sortAccounts(accounts).map((account) => (
						<SelectItem key={account.id} value={account.id}>
							{formatAccountDisplayName(account)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="type-body-xs text-muted-foreground">
				{value === NO_ACCOUNT
					? "Payments only go to your budget."
					: "Each payment is also recorded on this account, so don't add it there by hand."}
			</p>
		</div>
	);
}
