"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
import type { AccountWithType } from "@/app/accounts/types";

interface RecurringTransferFieldsProps {
	idPrefix: string;
	fromAccountId: string;
	toAccountId: string;
	onChange: (value: { fromAccountId: string; toAccountId: string }) => void;
	accounts: AccountWithType[];
}

/** "From" and "To" pickers for a recurring transfer. The destination list leaves out the source. */
export function RecurringTransferFields({
	idPrefix,
	fromAccountId,
	toAccountId,
	onChange,
	accounts,
}: RecurringTransferFieldsProps) {
	const sorted = sortAccounts(accounts);
	return (
		<div className="space-y-2">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-from`}>
						From <span className="text-error">*</span>
					</Label>
					<Select
						value={fromAccountId}
						onValueChange={(value) =>
							onChange({ fromAccountId: value, toAccountId: value === toAccountId ? "" : toAccountId })
						}
					>
						<SelectTrigger id={`${idPrefix}-from`} className="h-10">
							<SelectValue placeholder="Choose an account" />
						</SelectTrigger>
						<SelectContent>
							{sorted.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{formatAccountDisplayName(account)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-to`}>
						To <span className="text-error">*</span>
					</Label>
					<Select value={toAccountId} onValueChange={(value) => onChange({ fromAccountId, toAccountId: value })}>
						<SelectTrigger id={`${idPrefix}-to`} className="h-10">
							<SelectValue placeholder="Choose an account" />
						</SelectTrigger>
						<SelectContent>
							{sorted
								.filter((account) => account.id !== fromAccountId)
								.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{formatAccountDisplayName(account)}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
			</div>
			<p className="type-body-xs text-muted-foreground">
				{accounts.length < 2
					? "Add at least two accounts to set up a transfer."
					: "Each transfer is recorded on both accounts. It isn't counted as spending in your budget."}
			</p>
		</div>
	);
}

/** The message for a transfer whose accounts aren't ready, or null when they are. */
export function transferAccountsError(fromAccountId: string, toAccountId: string): string | null {
	if (!fromAccountId || !toAccountId) return "Choose the account the money comes from and the one it goes to.";
	if (fromAccountId === toAccountId) return "The two accounts must be different.";
	return null;
}
