"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NetWorthSummaryProps {
	totalAssets: number;
	totalLiabilities: number;
	netWorth: number;
	previousTotalAssets?: number;
	previousTotalLiabilities?: number;
	previousNetWorth?: number;
}

export function NetWorthSummary({
	totalAssets,
	totalLiabilities,
	netWorth,
	previousTotalAssets,
	previousTotalLiabilities,
	previousNetWorth,
}: NetWorthSummaryProps) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const calculateChange = (current: number, previous?: number) => {
		if (!previous) return null;
		const amountChange = current - previous;
		const percentChange = ((current - previous) / previous) * 100;
		return {
			amount: amountChange,
			percent: percentChange,
			direction: amountChange >= 0 ? "up" : "down",
		};
	};

	const netWorthChange = calculateChange(netWorth, previousNetWorth);
	const assetsChange = calculateChange(totalAssets, previousTotalAssets);
	const liabilitiesChange = calculateChange(totalLiabilities, previousTotalLiabilities);

	const renderChange = (change: ReturnType<typeof calculateChange>, type: "asset" | "liability" | "networth") => {
		if (!change) return null;

		const isPositiveGood = type !== "liability";
		const isGood = isPositiveGood ? change.amount >= 0 : change.amount <= 0;

		return (
			<div className={cn("flex items-center gap-1.5 text-xs font-medium", isGood ? "text-green-500" : "text-red-500")}>
				{change.amount > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
				<span>
					{change.amount > 0 ? "+" : ""}
					{formatCurrency(change.amount)}
				</span>
				<span className="opacity-60">|</span>
				<span>
					{change.amount > 0 ? "+" : ""}
					{change.percent.toFixed(1)}%
				</span>
			</div>
		);
	};

	return (
		<Card className="relative p-6 overflow-hidden border-none shadow-lg">
			{/* Background Gradient & Pattern */}
			<div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40" />

			{/* Content */}
			<div className="relative flex flex-col gap-8">
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<div className="p-1.5 rounded-full bg-background/50 backdrop-blur-sm border shadow-sm">
							<DollarSign className="h-4 w-4 text-foreground" />
						</div>
						<span className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Net Worth</span>
					</div>

					<div className="flex flex-col gap-2">
						<div className="text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
							{formatCurrency(netWorth)}
						</div>
						{netWorthChange && <div>{renderChange(netWorthChange, "networth")}</div>}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-8 relative">
					{/* Vertical Separator */}
					<div className="absolute left-1/2 top-2 bottom-2 w-px bg-border/40" />

					{/* Assets */}
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium text-muted-foreground block uppercase tracking-wide">
							Total Assets
						</span>
						<div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalAssets)}</div>
						{assetsChange && <div>{renderChange(assetsChange, "asset")}</div>}
					</div>

					{/* Liabilities */}
					<div className="flex flex-col gap-1 pl-4">
						<span className="text-xs font-medium text-muted-foreground block uppercase tracking-wide">
							Total Liabilities
						</span>
						<div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalLiabilities)}</div>
						{liabilitiesChange && <div>{renderChange(liabilitiesChange, "liability")}</div>}
					</div>
				</div>
			</div>
		</Card>
	);
}
