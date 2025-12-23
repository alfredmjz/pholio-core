"use client";

import Link from "next/link";
import { AccountWithType } from "../types";
import { cn } from "@/lib/utils";
import { Landmark, Wallet, CreditCard, Building, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AccountCardProps {
	account: AccountWithType;
	onClick?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-CA", {
			style: "currency",
			currency: account.currency || "CAD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const accountClass = account.account_type?.class;
	const category = account.account_type?.category;

	const getAccountIcon = () => {
		switch (category) {
			case "banking":
				return <Landmark className="h-5 w-5" />;
			case "investment":
			case "retirement":
				return <TrendingUp className="h-5 w-5" />;
			case "property":
				return <Building className="h-5 w-5" />;
			case "credit":
			case "debt":
				return <CreditCard className="h-5 w-5" />;
			default:
				return <Wallet className="h-5 w-5" />;
		}
	};

	const getIconColor = () => {
		if (accountClass === "asset") {
			return "bg-green-100/50 text-green-600 dark:bg-green-500/10 dark:text-green-400";
		}
		return "bg-red-100/50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
	};

	const getProgressPercentage = () => {
		if (!account.target_balance) return null;
		if (accountClass === "asset") {
			return (account.current_balance / account.target_balance) * 100;
		} else {
			if (!account.original_amount) return null;
			return ((account.original_amount - account.current_balance) / account.original_amount) * 100;
		}
	};

	const progress = getProgressPercentage();

	// Helper to get badge label from manual mapping based on screenshot examples
	const getAccountTypeLabel = () => {
		const typeName = account.account_type.name.toLowerCase();
		if (typeName.includes("investment")) return "Investment";
		if (typeName.includes("brokerage") || account.name === "Robinhood") return "Brokerage"; // Fallback for specific name
		if (typeName.includes("savings")) return "Savings";
		if (typeName.includes("credit card")) return "Credit Card";
		if (typeName.includes("loan")) return "Loan";
		// Default to category-based fallback
		if (category === "retirement") return "Retirement";
		return account.account_type.name;
	};

	// Helper to calculate progress breakdown for assets with positive growth
	const getProgressBreakdown = () => {
		if (progress === null || !account.percent_change || accountClass !== "asset" || account.percent_change <= 0) {
			return { base: progress, contribution: 0 };
		}
		// Calculate amount that represents the change
		const current = account.current_balance;
		const previous = current / (1 + account.percent_change / 100);
		const changeAmount = current - previous;

		// Calculate how much PERCENTAGE of the goal that change represents
		const target = account.target_balance || 1;
		const contribution = (changeAmount / target) * 100;
		const base = (progress || 0) - contribution;

		return { base: Math.max(0, base), contribution: Math.max(0, contribution) };
	};

	const { base: baseProgress, contribution: contributionProgress } = getProgressBreakdown();

	const Content = (
		<div className="flex items-start gap-4 h-full">
			{/* Account Icon */}
			<div className={cn("p-2.5 rounded-xl shrink-0 transition-colors", getIconColor())}>{getAccountIcon()}</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<span className="font-semibold truncate text-foreground text-sm">{account.name}</span>
							<Badge
								variant="secondary"
								className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground border-border/50 bg-secondary/50"
							>
								{getAccountTypeLabel()}
							</Badge>
						</div>
						<div className="text-xs text-muted-foreground mb-3">{account.institution || "Generic Bank"}</div>
					</div>

					<div className="text-right">
						<div
							className={cn(
								"font-bold tracking-tight text-sm",
								accountClass === "asset" ? "" : "text-red-600 dark:text-red-400" // Assets use default text color, liabilities use red
							)}
						>
							{accountClass === "liability" && "-"}
							{formatCurrency(account.current_balance)}
						</div>
					</div>
				</div>

				{progress !== null && (
					<div className="mt-2 space-y-1.5">
						<div className="flex items-center justify-between text-xs font-medium">
							<span className="text-muted-foreground">{accountClass === "asset" ? "Goal Progress" : "Repayment"}</span>
							<div className="flex items-center gap-1">
								{contributionProgress > 0 ? (
									<>
										<span className="text-foreground">{(baseProgress ?? 0).toFixed(0)}%</span>
										<span className="text-emerald-500"> + {contributionProgress.toFixed(0)}%</span>
									</>
								) : (
									<span className="text-foreground">{progress.toFixed(0)}%</span>
								)}
							</div>
						</div>
						<div className="h-2 bg-muted rounded-full overflow-hidden flex items-center">
							{/* Base Bar */}
							<div
								className={cn(
									"h-full rounded-r-full transition-all duration-500",
									accountClass === "asset" ? "bg-green-600 dark:bg-green-500" : "bg-red-500"
								)}
								style={{ width: `${Math.min(baseProgress || progress || 0, 100)}%` }}
							/>
							{/* Contribution Segment (Assets only) */}
							{contributionProgress > 0 && (
								<div
									className="h-full bg-green-500/30 border border-green-500 rounded-r-full -ml-0.5 box-border transition-all duration-500"
									style={{ width: `${Math.min(contributionProgress, 100 - (baseProgress || 0))}%` }}
								/>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);

	// Enforce consistent height with min-h
	const cardClasses =
		"block w-full text-left px-3 transition-all duration-200 bg-card hover:bg-accent relative hover:z-10 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_24px_rgba(255,255,255,0.08)] min-h-[140px] flex flex-col justify-center";

	if (onClick) {
		return (
			<button onClick={onClick} className={cardClasses}>
				{Content}
			</button>
		);
	}

	return (
		<Link href={`/balancesheet/${account.id}`} className={cardClasses}>
			{Content}
		</Link>
	);
}
