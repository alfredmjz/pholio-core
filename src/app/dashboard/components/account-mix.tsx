import Link from "next/link";
import { formatCurrency } from "@/app/dashboard/utils";
import type { DashboardAccount } from "../types";
import { DashboardSection } from "./dashboard-section";

function AccountGroup({ title, accounts, tone }: { title: string; accounts: DashboardAccount[]; tone: "own" | "owe" }) {
	if (accounts.length === 0) return null;
	const total = accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
	// Largest balances first: this section answers "where does my money sit".
	const sorted = [...accounts].sort((a, b) => b.balance - a.balance);

	return (
		<div>
			<div className="flex items-baseline justify-between gap-4">
				<h3 className="type-label text-muted-foreground">{title}</h3>
				<span className="type-value text-primary">{formatCurrency(total)}</span>
			</div>
			<ul className="mt-2">
				{sorted.map((account) => {
					const share = total > 0 ? (Math.max(0, account.balance) / total) * 100 : 0;
					return (
						<li key={account.id}>
							<Link
								href={`/balancesheet/accountdetail/${account.id}`}
								className="row-interactive -mx-2 block rounded-lg px-2 py-2"
							>
								<span className="flex items-baseline justify-between gap-3">
									<span className="min-w-0 truncate">
										<span className="type-body-sm font-medium text-primary">{account.name}</span>
										{account.institution && (
											<span className="type-body-xs ml-2 text-muted-foreground">{account.institution}</span>
										)}
									</span>
									<span className="type-value shrink-0 text-primary">{formatCurrency(account.balance)}</span>
								</span>
								<span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-primary/[0.07]" aria-hidden>
									<span
										className={
											tone === "own"
												? "block h-full rounded-full bg-primary/70"
												: "block h-full rounded-full bg-error/70"
										}
										style={{ width: `${share}%` }}
									/>
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Where the money sits: each account's share of what you own and what you owe. */
export function AccountMix({ accounts }: { accounts: DashboardAccount[] }) {
	const owned = accounts.filter((a) => a.class === "asset");
	const owed = accounts.filter((a) => a.class === "liability");

	return (
		<DashboardSection id="accounts-heading" title="Accounts" action={{ label: "Balance sheet", href: "/balancesheet" }}>
			{accounts.length === 0 ? (
				<p className="type-body-sm text-muted-foreground">
					Add your chequing, savings, cards and loans to see your net worth take shape.{" "}
					<Link href="/balancesheet" className="text-primary underline-offset-4 hover:underline">
						Add an account
					</Link>
				</p>
			) : (
				<div className="space-y-6">
					<AccountGroup title="You own" accounts={owned} tone="own" />
					<AccountGroup title="You owe" accounts={owed} tone="owe" />
				</div>
			)}
		</DashboardSection>
	);
}
