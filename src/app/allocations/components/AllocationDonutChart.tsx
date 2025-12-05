"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, getCategoryColor } from "./CategoryPerformance";
import type { AllocationCategory } from "../types";

interface AllocationDonutChartProps {
	categories: AllocationCategory[];
	className?: string;
}

export function AllocationDonutChart({
	categories,
	className,
}: AllocationDonutChartProps) {
	const totalSpent = useMemo(() => {
		return categories.reduce((sum, cat) => sum + (cat.actual_spend || 0), 0);
	}, [categories]);

	// Calculate segments for the donut chart
	const segments = useMemo(() => {
		if (categories.length === 0 || totalSpent === 0) return [];

		let currentAngle = 0;
		return categories
			.filter((cat) => (cat.actual_spend || 0) > 0)
			.map((cat, index) => {
				const spend = cat.actual_spend || 0;
				const percentage = (spend / totalSpent) * 100;
				const angle = (percentage / 100) * 360;
				const startAngle = currentAngle;
				currentAngle += angle;

				return {
					category: cat,
					percentage,
					startAngle,
					endAngle: currentAngle,
					colorIndex: categories.findIndex((c) => c.id === cat.id),
				};
			});
	}, [categories, totalSpent]);

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	// SVG arc path generator
	const describeArc = (
		x: number,
		y: number,
		radius: number,
		startAngle: number,
		endAngle: number
	) => {
		const start = polarToCartesian(x, y, radius, endAngle);
		const end = polarToCartesian(x, y, radius, startAngle);
		const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

		return [
			"M", start.x, start.y,
			"A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
		].join(" ");
	};

	const polarToCartesian = (
		centerX: number,
		centerY: number,
		radius: number,
		angleInDegrees: number
	) => {
		const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
		return {
			x: centerX + radius * Math.cos(angleInRadians),
			y: centerY + radius * Math.sin(angleInRadians),
		};
	};

	// Color mapping for SVG strokes
	const getStrokeColor = (colorIndex: number) => {
		const colors = [
			"#06b6d4", // cyan-500
			"#10b981", // emerald-500
			"#f59e0b", // amber-500
			"#ec4899", // pink-500
			"#3b82f6", // blue-500
			"#ef4444", // red-500
			"#8b5cf6", // purple-500
			"#f97316", // orange-500
		];
		return colors[colorIndex % colors.length];
	};

	return (
		<Card className={cn("p-6 flex flex-col", className)}>
			<div className="mb-4">
				<h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
					Allocation
				</h3>
				<p className="text-xs text-muted-foreground mt-0.5">
					Spending distribution by category
				</p>
			</div>

			<div className="flex flex-col items-center justify-center flex-1">
				{/* Donut Chart */}
				<div className="relative w-40 h-40 mb-6">
					<svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
						{/* Background circle */}
						<circle
							cx="50"
							cy="50"
							r="40"
							fill="none"
							stroke="currentColor"
							strokeWidth="12"
							className="text-muted"
						/>

						{/* Category segments */}
						{segments.length > 0 ? (
							segments.map((segment, index) => (
								<path
									key={segment.category.id}
									d={describeArc(50, 50, 40, segment.startAngle, segment.endAngle - 0.5)}
									fill="none"
									stroke={getStrokeColor(segment.colorIndex)}
									strokeWidth="12"
									strokeLinecap="round"
									className="transition-all duration-500"
								/>
							))
						) : (
							<circle
								cx="50"
								cy="50"
								r="40"
								fill="none"
								stroke="currentColor"
								strokeWidth="12"
								className="text-muted"
							/>
						)}
					</svg>

					{/* Center text */}
					<div className="absolute inset-0 flex flex-col items-center justify-center">
						<span className="text-xs text-muted-foreground">Total</span>
						<span className="text-xl font-bold text-foreground">
							{formatCurrency(totalSpent)}
						</span>
					</div>
				</div>

				{/* Legend */}
				<div className="w-full grid grid-cols-2 gap-x-3 gap-y-1.5">
					{categories.map((category, index) => {
						const color = getCategoryColor(index);
						return (
							<div key={category.id} className="flex items-center gap-2">
								<div className={cn("w-2 h-2 rounded-full flex-shrink-0", color.bg)} />
								<span className="text-xs text-muted-foreground truncate">
									{category.name}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}
