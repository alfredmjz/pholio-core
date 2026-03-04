"use client";

import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AccountWithType } from "../../../types";
import { getFieldVisibility } from "../../../field-visibility";

interface BalanceCardProps {
	account: AccountWithType;
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
}

export function BalanceCard({ account, accountClass, formatCurrency }: BalanceCardProps) {
	const visibility = getFieldVisibility(account.account_type?.category, account.account_type?.name);

	const goalValue = visibility.showOriginalAmount ? account.original_amount : account.target_balance;
	const showGoal = visibility.showOriginalAmount
		? !!account.original_amount
		: visibility.showTargetGoal && !!account.target_balance;

	const progress = goalValue
		? accountClass === "asset"
			? (account.current_balance / goalValue) * 100
			: ((goalValue - account.current_balance) / goalValue) * 100
		: null;

	const remaining = goalValue ? (accountClass === "asset" ? goalValue - account.current_balance : null) : null;

	const estimatedAnnualInterest =
		account.interest_rate && account.current_balance ? account.current_balance * account.interest_rate : null;

	return (
		<Card className="p-6">
			<div className="flex flex-col gap-6">
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
						{account.interest_rate && visibility.showInterestRate && (
							<div className="flex items-center gap-2 text-sm text-primary">
								<span>{visibility.interestRateLabel.replace(" (%)", "")}:</span>
								<span className="font-medium">{(account.interest_rate * 100).toFixed(1)}%</span>
							</div>
						)}
					</div>

					{/* Estimated Annual Interest Badge */}
					{estimatedAnnualInterest !== null && estimatedAnnualInterest > 0 && (
						<Badge
							variant="secondary"
							className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
						>
							<TrendingUp className="h-3 w-3" />+{formatCurrency(estimatedAnnualInterest)}/yr
						</Badge>
					)}
				</div>

				{/* Progress to Goal / Payoff */}
				{showGoal && goalValue && progress !== null && (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium text-primary">
								{visibility.showOriginalAmount ? "Loan Progress" : "Progress to Goal"}
							</span>
							<span className="font-medium">{formatCurrency(goalValue)}</span>
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

