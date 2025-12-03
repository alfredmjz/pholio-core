"use client";

import { Card } from "@/components/ui/card";
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
		overall_utilization,
	} = summary;

	return (
		<Card className="p-6 border-2 border-neutral-900 bg-neutral-50 shadow-lg mb-6">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
				{/* Unallocated Funds */}
				<div>
					<div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mb-1">
						Unallocated
					</div>
					<div className="text-3xl font-bold text-blue-600">
						${unallocated_funds.toFixed(0)}
					</div>
					<div className="text-xs text-neutral-500 mt-0.5">
						from ${expectedIncome.toFixed(0)} income
					</div>
				</div>

				{/* Budget Cap */}
				<div>
					<div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mb-1">
						Budget Cap
					</div>
					<div className="text-3xl font-bold text-neutral-900">
						${total_budget_caps.toFixed(0)}
					</div>
					<div className="text-xs text-neutral-500 mt-0.5">total allocated</div>
				</div>

				{/* Actual Spend */}
				<div>
					<div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mb-1">
						Actual Spend
					</div>
					<div className="text-3xl font-bold text-red-600">
						${total_actual_spend.toFixed(0)}
					</div>
					<div className="text-xs text-neutral-500 mt-0.5">
						{total_budget_caps > 0
							? `${((total_actual_spend / total_budget_caps) * 100).toFixed(0)}% of budget`
							: "no budget set"}
					</div>
				</div>

				{/* Utilization */}
				<div>
					<div className="text-xs uppercase tracking-wide text-neutral-600 font-medium mb-1">
						Utilization
					</div>
					<div className="flex items-end gap-3">
						<div className="text-3xl font-bold text-neutral-900">
							{overall_utilization.toFixed(0)}%
						</div>
						<div className="mb-1.5 flex-1">
							<div className="h-2 bg-neutral-300 rounded-full overflow-hidden">
								<div
									className={`h-full transition-all duration-300 rounded-full ${
										overall_utilization <= 80
											? "bg-green-500"
											: overall_utilization <= 100
											? "bg-yellow-500"
											: "bg-red-500"
									}`}
									style={{ width: `${Math.min(overall_utilization, 100)}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Card>
	);
}
