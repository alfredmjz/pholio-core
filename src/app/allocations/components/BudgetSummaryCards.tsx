"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, CircleDashed, TrendingUp, TrendingDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateExpectedIncome } from "../actions";
import type { IncomeVerificationResult } from "../types";

interface BudgetSummaryCardsProps {
	expectedIncome: number;
	totalBudgetAllocated: number;
	totalSpent: number;
	incomeVerification: IncomeVerificationResult;
	allocationId?: string;
	className?: string;
}

export function BudgetSummaryCards({
	expectedIncome,
	totalBudgetAllocated,
	totalSpent,
	incomeVerification,
	allocationId,
	className,
}: BudgetSummaryCardsProps) {
	const router = useRouter();
	const isOverAllocated = totalBudgetAllocated > expectedIncome;
	const savingsEstimate = expectedIncome - totalSpent;
	const [isDriftDismissed, setIsDriftDismissed] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const handleUpdateIncome = async () => {
		if (!allocationId || !incomeVerification.drift) return;
		setIsUpdating(true);
		try {
			const success = await updateExpectedIncome(allocationId, incomeVerification.drift.suggestedAmount);
			if (success) {
				toast.success("Expected income updated!");
				setIsDriftDismissed(true);
				router.refresh();
			} else {
				toast.error("Failed to update expected income");
			}
		} finally {
			setIsUpdating(false);
		}
	};

	const renderVerificationBadge = () => {
		const { status, consecutiveMatches } = incomeVerification;

		if (status === "verified") {
			return (
				<div
					className="flex items-center gap-1.5 mt-2"
					title={`Income matched for ${consecutiveMatches} consecutive months`}
				>
					<CheckCircle2 className="h-4 w-4 text-success" />
					<span className="text-xs text-success font-medium">Verified</span>
				</div>
			);
		}

		if (status === "tracking") {
			const remaining = 3 - consecutiveMatches;
			return (
				<div
					className="flex items-center gap-1.5 mt-2"
					title={`Need ${remaining} more month${remaining !== 1 ? "s" : ""} of consistent income`}
				>
					<Clock className="h-4 w-4 text-warning" />
					<span className="text-xs text-warning font-medium">Tracking</span>
				</div>
			);
		}

		// not_set
		return (
			<div className="flex items-center gap-1.5 mt-2" title="Set your expected income to start tracking">
				<CircleDashed className="h-4 w-4 text-muted-foreground" />
				<span className="text-xs text-muted-foreground font-medium">Not Set</span>
			</div>
		);
	};

	const showDrift = incomeVerification.drift?.detected && !isDriftDismissed && allocationId;

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card className="p-5 bg-card border border-border relative overflow-hidden group">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
					<div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 opacity-70 group-hover:opacity-100" />
					<div
						className={cn(
							"absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-70",
							incomeVerification.status === "verified" && "bg-success/10",
							incomeVerification.status === "tracking" && "bg-warning/10",
							incomeVerification.status === "not_set" && "bg-muted/10"
						)}
					/>

					<div className="relative z-10">
						<p className="text-sm text-primary font-medium mb-1">Expected Income</p>
						<p className="text-3xl font-bold text-primary">{formatCurrency(expectedIncome)}</p>
						{renderVerificationBadge()}
					</div>
				</Card>

				<Card className="p-5 bg-card border border-border relative overflow-hidden group">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
					<div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 opacity-70 group-hover:opacity-100" />
					<div
						className={cn(
							"absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-70",
							isOverAllocated ? "bg-error/20" : "bg-success/10"
						)}
					/>

					<div className="relative z-10">
						<p className="text-sm text-primary font-medium mb-1">Total Budgeted</p>
						<p className={cn("text-3xl font-bold", isOverAllocated ? "text-error" : "text-success")}>
							{formatCurrency(totalBudgetAllocated)}
						</p>
						<p className={cn("text-xs font-medium mt-2", isOverAllocated ? "text-error" : "text-success")}>
							{isOverAllocated ? "Over allocated" : "On track"}
						</p>
					</div>
				</Card>

				<Card className="p-5 bg-card border border-border relative overflow-hidden group">
					<div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
					<div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 opacity-70 group-hover:opacity-100" />
					<div
						className={cn(
							"absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-70",
							savingsEstimate < 0 ? "bg-error/20" : "bg-success/10"
						)}
					/>

					<div className="relative z-10">
						<p className="text-sm text-primary font-medium mb-1">Savings Estimate</p>
						<p className={cn("text-3xl font-bold", savingsEstimate < 0 ? "text-error" : "text-success")}>
							{savingsEstimate < 0 ? "-" : ""}
							{formatCurrency(Math.abs(savingsEstimate))}
						</p>
						<div className="mt-3">
							<div className="h-2 bg-muted rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full rounded-full transition-all duration-500",
										savingsEstimate >= 0 ? "bg-success" : "bg-error"
									)}
									style={{
										width: `${Math.min(expectedIncome > 0 ? (totalSpent / expectedIncome) * 100 : 0, 100)}%`,
									}}
								/>
							</div>
						</div>
					</div>
				</Card>
			</div>

			{showDrift && incomeVerification.drift && (
				<Card className="p-4 bg-card border border-border">
					<div className="flex items-start gap-3">
						{incomeVerification.drift.direction === "increase" ? (
							<TrendingUp className="h-5 w-5 text-success shrink-0 mt-0.5" />
						) : (
							<TrendingDown className="h-5 w-5 text-warning shrink-0 mt-0.5" />
						)}
						<div className="flex-1 min-w-0">
							<p className="text-sm text-primary font-medium">
								Income {incomeVerification.drift.direction === "increase" ? "increase" : "decrease"} detected
							</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								Your income has been ~{formatCurrency(incomeVerification.drift.suggestedAmount)} for{" "}
								{incomeVerification.drift.monthsObserved} months. Update expected income?
							</p>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<button
								onClick={handleUpdateIncome}
								disabled={isUpdating}
								className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
							>
								{isUpdating ? "Updating..." : "Update"}
							</button>
							<button
								onClick={() => setIsDriftDismissed(true)}
								className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
								title="Dismiss"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
				</Card>
			)}
		</div>
	);
}
