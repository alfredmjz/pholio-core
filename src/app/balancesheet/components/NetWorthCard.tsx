"use client";

import { Card } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { DonutChart } from "@/components/common/DonutChart";
import { cn } from "@/lib/utils";

interface NetWorthCardProps {
	netWorth: number;
	totalAssets: number;
	totalLiabilities: number;
	previousNetWorth?: number;
}

export function NetWorthCard({ netWorth, totalAssets, totalLiabilities, previousNetWorth }: NetWorthCardProps) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(amount);
	};

	const formatFullCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const percentChange = previousNetWorth ? ((netWorth - previousNetWorth) / previousNetWorth) * 100 : 0;
	const isPositive = percentChange >= 0;

	const data = [
		{ name: "Assets", value: totalAssets, color: "#10b981" }, // green-500
		{ name: "Liabilities", value: totalLiabilities, color: "#ef4444" }, // red-500
	];

	return (
		<Card className="p-6 h-full flex flex-col justify-between">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-primary">Net Worth</h3>
				<Info className="h-4 w-4 text-primary/50" />
			</div>

			<div className="flex items-start justify-between flex-1">
				<div className="space-y-1 flex flex-col justify-center h-full">
					<div className="text-4xl font-bold tracking-tight">{formatCurrency(netWorth)}</div>
					<div
						className={cn(
							"flex items-center gap-1 text-sm font-medium",
							isPositive ? "text-green-500" : "text-red-500"
						)}
					>
						{isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
						{Math.abs(percentChange).toFixed(1)}% vs. last month
					</div>

					<div className="pt-4 grid grid-cols-2 gap-x-8 gap-y-2">
						<div className="space-y-0.5">
							<div className="flex items-center gap-2">
								<div className="w-1 h-3 rounded-full bg-green-500" />
								<span className="text-[10px] text-primary uppercase font-bold tracking-wider">Assets</span>
							</div>
							<div className="text-sm font-bold">{formatCurrency(totalAssets)}</div>
						</div>
						<div className="space-y-0.5">
							<div className="flex items-center gap-2">
								<div className="w-1 h-3 rounded-full bg-red-500" />
								<span className="text-[10px] text-primary uppercase font-bold tracking-wider">Liabilities</span>
							</div>
							<div className="text-sm font-bold">{formatCurrency(totalLiabilities)}</div>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-center pr-2">
					<DonutChart data={data} size={32} strokeWidth={14} gap={0} className="scale-110" />
				</div>
			</div>
		</Card>
	);
}
