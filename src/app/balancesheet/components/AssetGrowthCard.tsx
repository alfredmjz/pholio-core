"use client";

import { Card } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { HistoricalDataPoint } from "../types";

interface AssetGrowthCardProps {
	totalAssets: number;
	previousTotalAssets?: number;
	historicalData: HistoricalDataPoint[];
}

export function AssetGrowthCard({ totalAssets, previousTotalAssets, historicalData }: AssetGrowthCardProps) {
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

	const percentChange = previousTotalAssets ? ((totalAssets - previousTotalAssets) / previousTotalAssets) * 100 : 0;
	const isPositive = percentChange >= 0;

	return (
		<Card className="p-6 h-full flex flex-col justify-between">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-muted-foreground">Asset Growth</h3>
				<Info className="h-4 w-4 text-muted-foreground/50" />
			</div>

			<div className="space-y-1">
				<div className="text-4xl font-bold tracking-tight">{formatCurrency(totalAssets)}</div>
				<div
					className={cn(
						"flex items-center gap-1 text-sm font-medium",
						isPositive ? "text-emerald-500" : "text-red-500"
					)}
				>
					{isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
					{Math.abs(percentChange).toFixed(1)}% vs. last month
				</div>
			</div>

			<div className="mt-6 w-full h-[120px] flex flex-col items-center justify-center">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={historicalData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
						<Bar dataKey="value" isAnimationActive={false}>
							{historicalData.map((entry, index) => (
								<Cell key={`cell-${index}`} fill={entry.hasActivity ? "#10b981" : "#10b98140"} />
							))}
						</Bar>
						<Tooltip
							cursor={{ fill: "transparent" }}
							content={({ active, payload }) => {
								if (active && payload && payload.length) {
									return (
										<div className="bg-background border rounded-lg p-2 shadow-md text-xs">
											<div className="text-muted-foreground mb-1">{payload[0].payload.date}</div>
											<div className="font-bold">{formatFullCurrency(Number(payload[0].value))}</div>
										</div>
									);
								}
								return null;
							}}
						/>
					</BarChart>
				</ResponsiveContainer>
				<p className="text-[10px] text-muted-foreground mt-1 w-full text-left">Last 30 days</p>
			</div>
		</Card>
	);
}
