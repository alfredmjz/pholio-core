"use client";

import { Card } from "@/components/ui/card";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";
import { HistoricalDataPoint } from "../types";

interface DebtRundownCardProps {
	totalLiabilities: number;
	previousTotalLiabilities?: number;
	historicalData: HistoricalDataPoint[];
}

export function DebtRundownCard({
	totalLiabilities,
	previousTotalLiabilities = 0,
	historicalData,
}: DebtRundownCardProps) {
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

	const percentChange =
		previousTotalLiabilities > 0 ? ((totalLiabilities - previousTotalLiabilities) / previousTotalLiabilities) * 100 : 0;

	// For debt:
	// Increase (positive change) is bad (Red)
	// Decrease (negative change) is good (Green)
	const isGood = percentChange <= 0;

	// Find max value to calculate a proportional minimum line height (3% of max) for visibility
	const maxValue = Math.max(...historicalData.map((d) => d.value), 1);
	const minLineValue = maxValue * 0.03;

	// Transform data to give zero-value points a visible minimum for the line chart
	const chartData = historicalData.map((d) => ({
		...d,
		displayValue: d.value > 0 ? d.value : minLineValue,
		actualValue: d.value,
	}));

	return (
		<Card className="p-6 h-full flex flex-col justify-between">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-primary">Debt Rundown</h3>
				<Info className="h-4 w-4 text-primary/50" />
			</div>

			<div className="space-y-1">
				<div className="text-4xl font-bold tracking-tight">{formatCurrency(totalLiabilities)}</div>
				<div className={cn("flex items-center gap-1 text-sm font-medium", isGood ? "text-green-500" : "text-red-500")}>
					{percentChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
					{Math.abs(percentChange).toFixed(1)}% vs. last month
				</div>
			</div>

			<div className="mt-6 w-full flex flex-col items-center justify-center">
				<div className="h-[120px] w-full min-h-[120px]">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
							<Line
								type="monotone"
								dataKey="displayValue"
								stroke="#f97316"
								strokeWidth={2}
								dot={(props: any) => {
									const { cx, cy, payload } = props;
									if (payload.hasActivity) {
										return <circle cx={cx} cy={cy} r={3} fill="#f97316" stroke="none" />;
									}
									return <></>;
								}}
								isAnimationActive={false}
								activeDot={{ r: 4, fill: "#f97316" }}
							/>
							<Tooltip
								content={({ active, payload }) => {
									if (active && payload && payload.length) {
										return (
											<div className="bg-background border rounded-lg p-2 shadow-md text-xs">
												<div className="text-muted-foreground mb-1">{payload[0].payload.date}</div>
												<div className="font-bold">{formatFullCurrency(payload[0].payload.actualValue)}</div>
											</div>
										);
									}
									return null;
								}}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
				<p className="text-[10px] text-primary mt-1 w-full text-left">Last 30 days</p>
			</div>
		</Card>
	);
}

