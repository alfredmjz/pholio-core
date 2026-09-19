"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export interface DonutChartData {
	name: string;
	value: number;
	color: string;
}

interface DonutChartProps {
	data: DonutChartData[];
	/** Controls the rendered size in pixels (`size * 4`). */
	size?: number;
	className?: string;
	centerContent?: React.ReactNode;
	showTooltip?: boolean;
	/**
	 * Minimum share (percent) granted to any non-zero segment so tiny-but-real values
	 * stay visible. Larger segments absorb the difference proportionally. 0 disables it.
	 */
	minSegmentPercentage?: number;
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

/** Uses magnitudes, and floors tiny non-zero slices so they stay visible. */
function prepareData(data: DonutChartData[], minSegmentPercentage: number): DonutChartData[] {
	const positive = data
		.filter((item) => Math.abs(item.value) > 0)
		.map((item) => ({ ...item, value: Math.abs(item.value) }));

	if (positive.length === 0) return [];

	const total = positive.reduce((sum, item) => sum + item.value, 0);
	if (total <= 0 || minSegmentPercentage <= 0) return positive;

	const percentages = positive.map((item) => (item.value / total) * 100);
	const belowCount = percentages.filter((p) => p < minSegmentPercentage).length;
	if (belowCount === 0 || minSegmentPercentage * belowCount >= 100) return positive;

	const remaining = 100 - minSegmentPercentage * belowCount;
	const aboveTotal = percentages.filter((p) => p >= minSegmentPercentage).reduce((sum, p) => sum + p, 0);

	return positive.map((item, index) => ({
		...item,
		value:
			percentages[index] < minSegmentPercentage
				? minSegmentPercentage
				: aboveTotal > 0
					? (percentages[index] / aboveTotal) * remaining
					: remaining,
	}));
}

function DonutTooltip({ active, payload }: any) {
	if (!active || !payload || !payload.length) return null;
	const entry = payload[0];
	return (
		<div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 flex flex-col gap-1">
			<div className="flex items-center gap-2 text-sm">
				<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.color }} />
				<span className="font-medium text-muted-foreground">{entry.name}</span>
			</div>
			<span className="font-bold text-base">{formatCurrency(entry.value)}</span>
		</div>
	);
}

/**
 * Shared donut ring. Matches the account detail Insights ring: rounded segment
 * corners, a small gap between slices, no stroke, and an optional centered label.
 */
export function DonutChart({
	data,
	size = 40,
	className,
	centerContent,
	showTooltip = false,
	minSegmentPercentage = 0,
}: DonutChartProps) {
	const chartData = useMemo(() => prepareData(data, minSegmentPercentage), [data, minSegmentPercentage]);

	return (
		<div className={cn("relative", className)} style={{ width: size * 4, height: size * 4 }}>
			<PieChart width={size * 4} height={size * 4}>
				<Pie
					data={chartData as any[]}
					dataKey="value"
					nameKey="name"
					innerRadius="63%"
					outerRadius="82%"
					paddingAngle={5}
					cornerRadius={6}
					stroke="none"
				>
					{chartData.map((entry, index) => (
						<Cell key={index} fill={entry.color} />
					))}
				</Pie>
				{showTooltip && <Tooltip content={<DonutTooltip />} />}
			</PieChart>

			{centerContent && (
				<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
					{centerContent}
				</div>
			)}
		</div>
	);
}
