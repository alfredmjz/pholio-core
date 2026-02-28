import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryColor } from "../utils/colors";
import type { AllocationCategory } from "@/app/allocations/types";

interface SpendingAllocationProps {
	categories: AllocationCategory[];
	className?: string;
}

export function SpendingAllocation({ categories, className }: SpendingAllocationProps) {
	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	const { sortedCategories, totalSpent } = useMemo(() => {
		const withSpend = categories.filter((c) => (c.actual_spend || 0) > 0);
		const sorted = [...withSpend].sort((a, b) => (b.actual_spend || 0) - (a.actual_spend || 0));
		const total = sorted.reduce((sum, c) => sum + (c.actual_spend || 0), 0);
		return { sortedCategories: sorted, totalSpent: total };
	}, [categories]);

	// Render the card even if totalSpent is 0, so the user knows the component is there.
	const displayTotal = totalSpent > 0 ? totalSpent : 0;

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="space-y-1">
					<CardTitle className="text-base font-medium">Spending Allocation</CardTitle>
					<p className="text-sm text-muted-foreground">Breakdown by category</p>
				</div>
				<div className="text-right">
					<div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
					<p className="text-sm text-muted-foreground">total spent</p>
				</div>
			</CardHeader>
			<CardContent className="space-y-6 flex flex-col pt-0">
				{/* The Bar */}
				{displayTotal > 0 ? (
					<div className="h-8 w-full flex rounded-md overflow-hidden">
						{sortedCategories.map((c, idx) => {
							const value = c.actual_spend || 0;
							const percentage = (value / displayTotal) * 100;
							const categoryColor = getCategoryColor(c.id, c.color, idx);
							return (
								<div
									key={c.id}
									style={{ width: `${percentage}%` }}
									className={`${categoryColor.bg} hover:opacity-90 transition-opacity`}
									title={`${c.name}: ${formatCurrency(value)}`}
								/>
							);
						})}
					</div>
				) : (
					<div className="h-8 w-full flex rounded-md bg-secondary overflow-hidden"></div>
				)}

				{/* The Legend */}
				<div className="flex flex-wrap justify-between gap-y-6">
					{sortedCategories.map((c, idx) => {
						const value = c.actual_spend || 0;
						const categoryColor = getCategoryColor(c.id, c.color, idx);
						return (
							<div key={c.id} className="w-1/4 flex items-start gap-2 pr-4">
								<div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${categoryColor.bg}`} />
								<div className="flex flex-col">
									<span className="text-sm font-medium leading-none">{c.name}</span>
									<span className="text-sm text-muted-foreground mt-1">{formatCurrency(value)}</span>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
