"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BudgetSummaryCardsProps {
	expectedIncome: number;
	totalBudgetAllocated: number;
	totalSpent: number;
	className?: string;
}

export function BudgetSummaryCards({
	expectedIncome,
	totalBudgetAllocated,
	totalSpent,
	className,
}: BudgetSummaryCardsProps) {
	const isOverAllocated = totalBudgetAllocated > expectedIncome;
	const savingsEstimate = expectedIncome - totalSpent;

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	return (
		<div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
			<Card className="p-5 bg-card border border-border relative overflow-hidden">
				<div className="absolute top-0 right-0 w-32 h-32 opacity-10">
					<svg viewBox="0 0 100 100" className="w-full h-full">
						<path d="M0,50 Q25,30 50,50 T100,50 V100 H0 Z" fill="url(#gradient1)" />
						<defs>
							<linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
								<stop offset="0%" stopColor="#10b981" />
								<stop offset="50%" stopColor="#8b5cf6" />
								<stop offset="100%" stopColor="#3b82f6" />
							</linearGradient>
						</defs>
					</svg>
				</div>

				<div className="relative">
					<p className="text-sm text-primary font-medium mb-1">Expected Income</p>
					<p className="text-3xl font-bold text-primary">{formatCurrency(expectedIncome)}</p>
					<div className="flex items-center gap-1.5 mt-2">
						<CheckCircle2 className="h-4 w-4 text-success" />
						<span className="text-xs text-success font-medium">Verified</span>
					</div>
				</div>
			</Card>

			<Card className="p-5 bg-card border border-border">
				<p className="text-sm text-primary font-medium mb-1">Total Budgeted</p>
				<p className={cn("text-3xl font-bold", isOverAllocated ? "text-error" : "text-success")}>
					{formatCurrency(totalBudgetAllocated)}
				</p>
				<p className={cn("text-xs font-medium mt-2", isOverAllocated ? "text-error" : "text-success")}>
					{isOverAllocated ? "Over allocated" : "On track"}
				</p>
			</Card>

			<Card className="p-5 bg-card border border-border">
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
			</Card>
		</div>
	);
}
