"use client";

import { TrendingUp, Trophy, CheckCircle2 } from "lucide-react";
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

	let currentAmount = 0;
	let remainingAmount = 0;
	let progress = 0;

	if (goalValue) {
		if (accountClass === "asset") {
			currentAmount = account.current_balance;
			remainingAmount = goalValue - account.current_balance;
			progress = (account.current_balance / goalValue) * 100;
		} else {
			// For liabilities, goalValue is usually original_amount. current_balance is what's left to pay.
			currentAmount = goalValue - account.current_balance;
			remainingAmount = account.current_balance;
			progress = ((goalValue - account.current_balance) / goalValue) * 100;
		}
	}

	const displayProgress = Math.min(Math.max(progress, 0), 100);

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
				{showGoal && !!goalValue && (
					<div className="mt-2 flex flex-col gap-3 rounded-xl shadow-sm">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
								{visibility.showOriginalAmount ? (
									"Payoff Progress"
								) : (
									<>
										<Trophy className="h-4 w-4 text-amber-500" />
										Goal Progress
									</>
								)}
							</span>
							<span className="text-sm font-semibold">
								{formatCurrency(currentAmount)}{" "}
								<span className="text-muted-foreground font-normal">/ {formatCurrency(goalValue)}</span>
							</span>
						</div>

						<Progress
							value={displayProgress}
							className={cn(
								"h-2.5",
								accountClass === "asset"
									? "[&>div]:bg-green-500 dark:[&>div]:bg-green-400"
									: "[&>div]:bg-blue-500 dark:[&>div]:bg-blue-400"
							)}
						/>

						<div className="flex items-center justify-between text-xs mt-0.5">
							{remainingAmount > 0 ? (
								<span className="text-muted-foreground flex items-center gap-1.5">
									<span className="h-2 w-2 rounded-full bg-border" />
									<span>
										<span className="font-medium text-foreground">{formatCurrency(remainingAmount)}</span> remaining
									</span>
								</span>
							) : (
								<span className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
									<CheckCircle2 className="h-3.5 w-3.5" />
									{visibility.showOriginalAmount ? "Fully paid off!" : "Goal reached!"}
									{remainingAmount < 0 &&
										accountClass === "asset" &&
										` (+${formatCurrency(Math.abs(remainingAmount))})`}
								</span>
							)}

							{/* We removed the explicit % text per user request, optionally we could put it back here if desired, but user said "we can remove the percentage" */}
						</div>
					</div>
				)}
			</div>
		</Card>
	);
}

