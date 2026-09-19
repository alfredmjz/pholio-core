"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Landmark, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import type { AccountWithType, AccountTransaction } from "../../../types";
import { calculateAccountStanding } from "@/lib/account-validation-utils";

interface AccountStandingCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
	onPayRemaining?: (amount: number) => void;
}

export function AccountStandingCard({
	account,
	transactions,
	formatCurrency,
	onPayRemaining,
}: AccountStandingCardProps) {
	const standing = useMemo(() => {
		return calculateAccountStanding(account, transactions);
	}, [account, transactions]);

	if (standing.accountClass === "liability") {
		const isFullyPaid = standing.remainingDebt <= 0;

		return (
			<Card className="p-5 border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900/40">
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							<div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
								<CreditCard className="h-4 w-4" />
							</div>
							<div>
								<h3 className="text-sm font-semibold text-primary">Debt & Payment Standing</h3>
								<p className="text-xs text-muted-foreground">Real-time accumulated debt vs. payments made</p>
							</div>
						</div>
						{isFullyPaid ? (
							<Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-300">
								<CheckCircle2 className="h-3 w-3 mr-1" /> Paid Off
							</Badge>
						) : (
							<Badge
								variant="secondary"
								className="text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40"
							>
								Validated Limit
							</Badge>
						)}
					</div>

					<div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-background/80 border border-border/50 text-center">
						<div className="flex flex-col gap-0.5">
							<span className="text-[11px] font-medium text-muted-foreground">Total Accumulated Debt</span>
							<span className="text-sm font-bold text-primary">{formatCurrency(standing.totalAccumulatedDebt)}</span>
						</div>
						<div className="flex flex-col gap-0.5 border-x border-border/50 px-2">
							<span className="text-[11px] font-medium text-muted-foreground">Payments Made</span>
							<span className="text-sm font-bold text-green-600 dark:text-green-400">
								{formatCurrency(standing.totalPayments)}
							</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-[11px] font-medium text-muted-foreground">Remaining Debt</span>
							<span className="text-sm font-bold text-red-600 dark:text-red-400">
								{formatCurrency(standing.remainingDebt)}
							</span>
						</div>
					</div>

					<div className="flex items-center justify-between gap-4 pt-1">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
							<span>
								Payments & allocations are capped at remaining debt ({formatCurrency(standing.remainingDebt)}).
							</span>
						</div>

						{!isFullyPaid && onPayRemaining && (
							<Button
								size="sm"
								className="shrink-0 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
								onClick={() => onPayRemaining(standing.remainingDebt)}
							>
								Pay Remaining ({formatCurrency(standing.remainingDebt)})
								<ArrowRight className="h-3.5 w-3.5" />
							</Button>
						)}
					</div>
				</div>
			</Card>
		);
	}

	// Asset account
	return (
		<Card className="p-5 border-emerald-200/50 bg-emerald-50/20 dark:bg-emerald-950/10 dark:border-emerald-900/40">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
						<Landmark className="h-5 w-5" />
					</div>
					<div>
						<h3 className="text-sm font-semibold text-primary">Available Standing</h3>
						<p className="text-xs text-muted-foreground">
							Available balance for transfers & expenses:{" "}
							<span className="font-semibold text-primary">{formatCurrency(standing.availableBalance)}</span>
						</p>
					</div>
				</div>
				<Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400">
					Active Cash
				</Badge>
			</div>
		</Card>
	);
}
