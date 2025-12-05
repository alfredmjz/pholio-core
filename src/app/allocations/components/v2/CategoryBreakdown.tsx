"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CategoryRow } from "./CategoryRow";
import type { AllocationCategory, Transaction } from "../../types";

interface CategoryBreakdownProps {
	categories: AllocationCategory[];
	transactions: Transaction[];
	unallocatedFunds: number;
	onAddCategory: () => void;
}

export function CategoryBreakdown({
	categories,
	transactions,
	unallocatedFunds,
	onAddCategory,
}: CategoryBreakdownProps) {
	if (categories.length === 0) {
		return (
			<Card className="p-8 text-center">
				<div className="max-w-sm mx-auto">
					<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
						<Plus className="h-8 w-8 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-semibold text-foreground mb-2">
						No Categories Yet
					</h3>
					<p className="text-sm text-muted-foreground mb-6">
						Create your first budget category to start tracking your spending for this month.
					</p>
					<Button onClick={onAddCategory} className="gap-2">
						<Plus className="h-4 w-4" />
						Add Your First Category
					</Button>
				</div>
			</Card>
		);
	}

	// Calculate totals
	const totalBudget = categories.reduce((sum, c) => sum + c.budget_cap, 0);
	const totalSpent = categories.reduce((sum, c) => sum + (c.actual_spend || 0), 0);

	return (
		<Card className="p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-sm font-semibold text-foreground">
						Category Breakdown
					</h3>
					<p className="text-xs text-muted-foreground mt-0.5">
						{categories.length} {categories.length === 1 ? "category" : "categories"} &middot;{" "}
						${totalSpent.toFixed(0)} of ${totalBudget.toFixed(0)} spent
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={onAddCategory}
					className="gap-2"
				>
					<Plus className="h-4 w-4" />
					Add
				</Button>
			</div>

			{/* Category Rows */}
			<div className="space-y-2">
				{categories.map((category) => (
					<CategoryRow
						key={category.id}
						category={category}
						transactions={transactions}
						unallocatedFunds={unallocatedFunds}
					/>
				))}
			</div>

			{/* Footer with unallocated info */}
			{unallocatedFunds !== 0 && (
				<div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
					<span className="text-sm text-muted-foreground">
						{unallocatedFunds > 0 ? "Funds available to allocate" : "Over-allocated by"}
					</span>
					<span className={`text-sm font-semibold ${
						unallocatedFunds > 0 ? "text-muted-foreground" : "text-error"
					}`}>
						${Math.abs(unallocatedFunds).toFixed(0)}
					</span>
				</div>
			)}
		</Card>
	);
}
