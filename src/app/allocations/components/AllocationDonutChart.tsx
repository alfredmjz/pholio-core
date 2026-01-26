"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryColor, getCategoryHex } from "../utils/colors";
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

	const chartDataWithColors = useMemo(() => {
		if (categories.length === 0) return [];

		return [...categories]
			.filter((cat) => (cat.actual_spend || 0) > 0)
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((cat) => ({
				name: cat.name,
				value: cat.actual_spend || 0,
				color: getCategoryHex(cat.id, cat.color, cat.display_order),
			}));
	}, [categories]);

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
				<div className="mb-6">
					<DonutChart
						data={chartDataWithColors}
						size={40}
						strokeWidth={12}
						centerContent={CenterContent}
						showTooltip={false}
					/>
				</div>

				<div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5">
					{[...categories]
						.sort((a, b) => a.name.localeCompare(b.name))
						.map((category) => {
							const color = getCategoryColor(category.id, category.color, category.display_order);
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
