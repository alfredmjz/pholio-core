"use client";

import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AccountWithType } from "../../../types";

interface BalanceCardProps {
	account: AccountWithType;
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
}

export function BalanceCard({ account, accountClass, formatCurrency }: BalanceCardProps) {
	const progress = account.target_balance
		? accountClass === "asset"
			? (account.current_balance / account.target_balance) * 100
			: account.original_amount
				? ((account.original_amount - account.current_balance) / account.original_amount) * 100
				: null
		: null;

	const remaining = account.target_balance
		? accountClass === "asset"
			? account.target_balance - account.current_balance
			: null
		: null;

	return (
		<Card className="p-6">
			<div className="flex flex-col gap-4">
				{/* Balance Header */}
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium text-primary">Current Balance</span>
						<div
							className={cn(
								"text-4xl font-bold tracking-tight",
								accountClass === "asset" ? "text-primary" : "text-red-600 dark:text-red-400"
							)}
						>
							{formatCurrency(account.current_balance)}
						</div>
						{account.interest_rate && (
							<div className="flex items-center gap-2 text-sm text-primary">
								<span>APY:</span>
								<span className="font-medium">{(account.interest_rate * 100).toFixed(1)}%</span>
							</div>
						)}
					</div>

					{/* Percentage Change Badge */}
					{account.percent_change !== undefined && account.percent_change !== null && (
						<Badge
							variant="secondary"
							className={cn(
								"flex items-center gap-1 px-2 py-1",
								account.percent_change >= 0
									? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
									: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
							)}
						>
							<TrendingUp className={cn("h-3 w-3", account.percent_change < 0 && "rotate-180")} />
							{account.percent_change >= 0 ? "+" : ""}
							{account.percent_change.toFixed(1)}% this month
						</Badge>
					)}
				</div>

				{/* Progress to Goal */}
				{account.target_balance && progress !== null && (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium text-primary">Progress to Goal</span>
							<span className="font-medium">{formatCurrency(account.target_balance)}</span>
						</div>
						<Progress
							value={Math.min(progress, 100)}
							className={cn("h-3", accountClass === "asset" ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
						/>
						<div className="text-xs text-primary">
							{progress.toFixed(0)}% complete
							{remaining !== null && remaining > 0 && <> • {formatCurrency(remaining)} remaining</>}
						</div>
					</div>
				)}
			</div>
		</Card>
	);
}
