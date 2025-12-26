"use client";

import { Card } from "@/components/ui/card";
import type { AccountWithType } from "../types";

interface DebtRundownCardProps {
	totalLiabilities: number;
	previousTotalLiabilities?: number;
	accounts: AccountWithType[];
}

export function DebtRundownCard({
	totalLiabilities,
	previousTotalLiabilities = 0,
	accounts = [],
}: DebtRundownCardProps) {
	const progress =
		totalLiabilities > 0 && previousTotalLiabilities > 0
			? ((previousTotalLiabilities - totalLiabilities) / previousTotalLiabilities) * 100
			: 0;
	const isImprovement = progress > 0;

	return (
		<Card className="p-6 bg-card border border-border">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-xl font-bold text-primary">Debt Rundown</h3>
					<p className="text-sm text-primary">Track your debt reduction</p>
				</div>
				{isImprovement && (
					<div className="px-3 py-1 rounded-full bg-success/20 text-xs font-semibold text-success">
						-{progress.toFixed(1)}%
					</div>
				)}
			</div>

			<div className="mb-6">
				<div className="text-4xl font-bold tracking-tight text-primary mb-1">
					{totalLiabilities.toLocaleString("en-US", { style: "currency", currency: "CAD" })}
				</div>
				<p className="text-sm text-primary">Total Liabilities</p>
			</div>

			<div className="space-y-4">
				{accounts.length === 0 ? (
					<div className="text-center py-8">
						<p className="text-sm text-primary">No liability accounts yet</p>
					</div>
				) : (
					accounts.map((account) => (
						<div key={account.id} className="flex items-center justify-between p-4 border border-border">
							<div className="flex-1">
								<p className="font-semibold text-primary">{account.name}</p>
								<p className="text-sm text-secondary">
									{account.account_type?.name} • {account.institution}
								</p>
							</div>
							<div className="text-right">
								<p className="text-2xl font-bold text-primary">
									{Math.abs(account.current_balance).toLocaleString("en-US", { style: "currency", currency: "CAD" })}
								</p>
							</div>
						</div>
					))
				)}
			</div>
		</Card>
	);
}

