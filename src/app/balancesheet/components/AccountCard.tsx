"use client";

import { AccountWithType } from "../types";
import { cn } from "@/lib/utils";
import { Landmark, Wallet, CreditCard, Building, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";

interface AccountCardProps {
	account: AccountWithType;
	isSelected: boolean;
	onClick: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}

export function AccountCard({ account, isSelected, onClick, onEdit, onDelete }: AccountCardProps) {
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
			return "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400";
		}
		return "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400";
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

	return (
		<button
			onClick={onClick}
			className={cn(
				"group w-full text-left p-4 rounded-xl border transition-all duration-200",
				isSelected
					? "bg-accent border-primary shadow-sm"
					: "bg-card border-border hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
			)}
		>
			<div className="flex items-start gap-4">
				{/* Account Icon */}
				<div className={cn("p-2.5 rounded-xl shrink-0 transition-colors", getIconColor())}>{getAccountIcon()}</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between gap-2 mb-1">
						<span className="font-semibold truncate text-foreground group-hover:text-primary transition-colors">
							{account.name}
						</span>
						{accountClass === "asset" ? (
							<ArrowUpRight className="h-3 w-3 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
						) : (
							<ArrowDownRight className="h-3 w-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
						)}
					</div>

					<div className="flex items-baseline gap-2 mb-2">
						<span
							className={cn(
								"text-lg font-bold tracking-tight",
								accountClass === "asset" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
							)}
						>
							{formatCurrency(account.current_balance)}
						</span>
						{account.interest_rate && (
							<span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
								{(account.interest_rate * 100).toFixed(2)}%
							</span>
						)}
					</div>

					{progress !== null && (
						<div className="space-y-1.5">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>{accountClass === "asset" ? "Goal Progress" : "Repayment"}</span>
								<span className="font-medium">{progress.toFixed(0)}%</span>
							</div>
							<div className="h-1.5 bg-muted rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full transition-all duration-500",
										accountClass === "asset" ? "bg-green-500" : "bg-red-500"
									)}
									style={{ width: `${Math.min(progress, 100)}%` }}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
		</button>
	);
}
