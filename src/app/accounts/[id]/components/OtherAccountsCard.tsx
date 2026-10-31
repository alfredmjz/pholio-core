"use client";

import Link from "next/link";
import { SurfaceSection } from "@/components/layout/surface-section";
import { formatCurrency } from "@/app/dashboard/utils";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import type { AccountWithType } from "../../types";

interface OtherAccountsCardProps {
	accounts: AccountWithType[];
}

/** A few of the user's other accounts, for hopping between them without going back to the list. */
export function OtherAccountsCard({ accounts }: OtherAccountsCardProps) {
	const displayAccounts = accounts.slice(0, 4);
	if (displayAccounts.length === 0) return null;

	return (
		<SurfaceSection
			id="other-accounts-heading"
			title="Other accounts"
			action={{ label: "All accounts", href: "/accounts" }}
		>
			<ul className="-mx-2 flex flex-col">
				{displayAccounts.map((account) => (
					<li key={account.id}>
						<Link
							href={`/accounts/${account.id}`}
							className="row-interactive flex items-center justify-between gap-3 rounded-xl px-2 py-2.5"
						>
							<span className="min-w-0">
								<span className="type-body-sm block truncate font-medium text-primary">{account.name}</span>
								<span className="type-body-xs block truncate text-muted-foreground">{account.account_type?.name}</span>
							</span>
							<span className="shrink-0 text-right">
								<span className="type-value text-primary">
									{account.account_type?.class === "liability" ? "-" : ""}
									{formatCurrency(Number(account.current_balance))}
								</span>
								{isInvestmentAccount(account) && (
									<span className="type-caption block text-muted-foreground">deposited</span>
								)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</SurfaceSection>
	);
}
