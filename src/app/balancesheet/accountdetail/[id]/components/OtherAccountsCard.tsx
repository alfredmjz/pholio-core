"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountWithType } from "../../../types";

interface OtherAccountsCardProps {
	accounts: AccountWithType[];
	currentAccountClass: "asset" | "liability" | undefined;
}

export function OtherAccountsCard({ accounts, currentAccountClass }: OtherAccountsCardProps) {
	// Show max 3 accounts
	const displayAccounts = accounts.slice(0, 3);

	if (displayAccounts.length === 0) {
		return null;
	}

	const formatCurrency = (amount: number, currency: string = "CAD") => {
		return new Intl.NumberFormat("en-CA", {
			style: "currency",
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	return (
		<Card className="p-4">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-muted-foreground">Other Accounts</h3>
				<Link href="/balancesheet" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
					View All
				</Link>
			</div>

			<div className="flex flex-col gap-1">
				{displayAccounts.map((account) => {
					const accountClass = account.account_type?.class;
					const isLiability = accountClass === "liability";

					return (
						<Link
							key={account.id}
							href={`/balancesheet/accountdetail/${account.id}`}
							className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-hover transition-colors"
						>
							<div className="flex flex-col">
								<span className="text-sm font-medium">{account.name}</span>
								<span className="text-xs text-muted-foreground">{account.account_type?.name}</span>
							</div>
							<span className={cn("text-sm font-medium", isLiability ? "text-red-600 dark:text-red-400" : "")}>
								{isLiability ? "-" : ""}
								{formatCurrency(account.current_balance, account.currency)}
							</span>
						</Link>
					);
				})}
			</div>
		</Card>
	);
}
