"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "./CategoryPerformance";
import type { AllocationCategory } from "../types";
import { DonutChart } from "@/components/common/DonutChart";

interface AllocationDonutChartProps {
	categories: AllocationCategory[];
	className?: string;
}

export function AllocationDonutChart({ categories, className }: AllocationDonutChartProps) {
	const totalSpent = useMemo(() => {
		return categories.reduce((sum, cat) => sum + (cat.actual_spend || 0), 0);
	}, [categories]);

	// Prepare data for shared DonutChart component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const CHART_COLORS = [
		"#06b6d4", // cyan-500
		"#10b981", // green-500
		"#f59e0b", // amber-500
		"#ec4899", // pink-500
		"#3b82f6", // blue-500
		"#ef4444", // red-500
		"#8b5cf6", // purple-500
		"#f97316", // orange-500
	];

	const chartDataWithColors = useMemo(() => {
		if (categories.length === 0) return [];
		return categories
			.filter((cat) => (cat.actual_spend || 0) > 0)
			.map((cat, index) => {
				// Find original index for color stability if needed, or just use current index
				const colorIndex = categories.findIndex((c) => c.id === cat.id);
				return {
					name: cat.name,
					value: cat.actual_spend || 0,
					color: CHART_COLORS[colorIndex % CHART_COLORS.length],
				};
			});
	}, [categories, CHART_COLORS]);

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const CenterContent = (
		<div className="flex flex-col items-center justify-center">
			<span className="text-xs text-primary">Total</span>
			<span className="text-xl font-bold text-primary">{formatCurrency(totalSpent)}</span>
		</div>
	);

	return (
		<Card className={cn("p-6 flex flex-col", className)}>
			<div className="mb-4">
				<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Allocation</h3>
				<p className="text-xs text-primary mt-0.5">Spending distribution by category</p>
			</div>

			<div className="flex flex-col items-center justify-center flex-1">
				{/* Donut Chart */}
				<div className="mb-6">
					<DonutChart
						data={chartDataWithColors}
						size={40}
						strokeWidth={12}
						centerContent={CenterContent}
						showTooltip={false} // Allocation page usually has legend
					/>
				</div>

				{/* Legend */}
				<div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5">
					{categories.map((category, index) => {
						const color = getCategoryColor(index);
						return (
							<div key={category.id} className="flex items-center gap-2">
								<div className={cn("w-2 h-2 rounded-full flex-shrink-0", color.bg)} />
								<span className="text-xs text-primary truncate">{category.name}</span>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}
