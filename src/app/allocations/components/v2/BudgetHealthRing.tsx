"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface BudgetHealthRingProps {
	expectedIncome: number;
	totalBudget: number;
	totalSpent: number;
	className?: string;
}

export function BudgetHealthRing({
	expectedIncome,
	totalBudget,
	totalSpent,
	className,
}: BudgetHealthRingProps) {
	const utilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
	const remaining = totalBudget - totalSpent;
	const unallocated = expectedIncome - totalBudget;

	// Calculate stroke dash for the progress ring
	const radius = 90;
	const circumference = 2 * Math.PI * radius;
	const strokeDashoffset = circumference - (Math.min(utilization, 100) / 100) * circumference;

	// Determine color based on utilization
	const getProgressColor = () => {
		if (utilization <= 60) return "stroke-success";
		if (utilization <= 80) return "stroke-success";
		if (utilization <= 100) return "stroke-warning";
		return "stroke-error";
	};

	const getTextColor = () => {
		if (utilization <= 80) return "text-success";
		if (utilization <= 100) return "text-warning";
		return "text-error";
	};

	// Format currency
	const formatCurrency = (value: number, compact = false) => {
		if (compact && Math.abs(value) >= 1000) {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD",
				notation: "compact",
				maximumFractionDigits: 1,
			}).format(value);
		}
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	return (
		<div className={cn("flex items-center justify-center gap-12", className)}>
			{/* Main Ring */}
			<div className="relative">
				<svg
					width="220"
					height="220"
					viewBox="0 0 220 220"
					className="transform -rotate-90"
				>
					{/* Background circle */}
					<circle
						cx="110"
						cy="110"
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth="12"
						className="text-muted"
					/>
					{/* Progress circle */}
					<circle
						cx="110"
						cy="110"
						r={radius}
						fill="none"
						strokeWidth="12"
						strokeLinecap="round"
						className={cn(getProgressColor(), "transition-all duration-700 ease-out")}
						style={{
							strokeDasharray: circumference,
							strokeDashoffset: strokeDashoffset,
						}}
					/>
					{/* Over-budget indicator (if > 100%) */}
					{utilization > 100 && (
						<circle
							cx="110"
							cy="110"
							r={radius}
							fill="none"
							strokeWidth="12"
							strokeLinecap="round"
							className="stroke-error/30"
							style={{
								strokeDasharray: circumference,
								strokeDashoffset: circumference - ((utilization - 100) / 100) * circumference,
							}}
						/>
					)}
				</svg>

				{/* Center content */}
				<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
					<span className="text-sm text-muted-foreground font-medium">
						{utilization.toFixed(0)}% Used
					</span>
					<span className={cn("text-3xl font-bold", getTextColor())}>
						{formatCurrency(remaining)}
					</span>
					<span className="text-sm text-muted-foreground">
						remaining
					</span>
				</div>
			</div>

			{/* Stats Panel */}
			<div className="space-y-4">
				{/* Expected Income */}
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-info" />
						<span className="text-sm text-muted-foreground">Expected Income</span>
					</div>
					<div className="text-2xl font-semibold text-foreground pl-5">
						{formatCurrency(expectedIncome)}
					</div>
				</div>

				{/* Total Budget */}
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-primary" />
						<span className="text-sm text-muted-foreground">Total Budget</span>
					</div>
					<div className="text-2xl font-semibold text-foreground pl-5">
						{formatCurrency(totalBudget)}
					</div>
				</div>

				{/* Total Spent */}
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<div className={cn("w-3 h-3 rounded-full", utilization > 100 ? "bg-error" : "bg-warning")} />
						<span className="text-sm text-muted-foreground">Total Spent</span>
					</div>
					<div className="text-2xl font-semibold text-foreground pl-5">
						{formatCurrency(totalSpent)}
					</div>
				</div>

				{/* Unallocated */}
				{unallocated !== 0 && (
					<div className="space-y-1 pt-2 border-t border-border">
						<div className="flex items-center gap-2">
							<div className={cn(
								"w-3 h-3 rounded-full",
								unallocated > 0 ? "bg-muted-foreground" : "bg-error"
							)} />
							<span className="text-sm text-muted-foreground">
								{unallocated > 0 ? "Unallocated" : "Over-allocated"}
							</span>
						</div>
						<div className={cn(
							"text-lg font-semibold pl-5",
							unallocated > 0 ? "text-muted-foreground" : "text-error"
						)}>
							{formatCurrency(Math.abs(unallocated))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
