"use client";

import { Card } from "@/components/ui/card";
import { FileText, TrendingDown, Clock } from "lucide-react";
import type { AllocationSummary } from "../types";

interface SummaryCardProps {
	summary: AllocationSummary["summary"];
	expectedIncome: number;
}

export function SummaryCard({ summary, expectedIncome }: SummaryCardProps) {
	const {
		total_budget_caps,
		total_actual_spend,
		unallocated_funds,
	} = summary;

	const remaining = total_budget_caps - total_actual_spend;

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			{/* Total Budget */}
			<Card className="p-6 border border-gray-200 bg-card hover:shadow-md transition-shadow">
				<div className="flex items-start justify-between mb-2">
					<div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide">
						<FileText className="h-4 w-4" />
						Total Budget
					</div>
				</div>
				<div className="text-3xl font-bold text-foreground">
					${total_budget_caps.toFixed(2)}
				</div>
			</Card>

			{/* Total Spent */}
			<Card className="p-6 border border-gray-200 bg-card hover:shadow-md transition-shadow">
				<div className="flex items-start justify-between mb-2">
					<div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide">
						<TrendingDown className="h-4 w-4" />
						Total Spent
					</div>
				</div>
				<div className="text-3xl font-bold text-foreground">
					${total_actual_spend.toFixed(2)}
				</div>
			</Card>

			{/* Remaining */}
			<Card className="p-6 border-2 border-gray-900 dark:border-gray-100 bg-card hover:shadow-md transition-shadow">
				<div className="flex items-start justify-between mb-2">
					<div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide">
						<Clock className="h-4 w-4" />
						Remaining
					</div>
				</div>
				<div className="text-3xl font-bold text-foreground">
					${remaining.toFixed(2)}
				</div>
			</Card>
		</div>
	);
}
