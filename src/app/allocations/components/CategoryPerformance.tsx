"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCategoryBudget, updateCategoryName, deleteCategory } from "../actions";
import { toast } from "sonner";
import { useAllocationContext } from "../context/AllocationContext";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import type { AllocationCategory } from "../types";

interface CategoryPerformanceProps {
	categories: AllocationCategory[];
	onAddCategory: () => void;
	className?: string;
}

// Color palette for categories (matching the screenshot)
const CATEGORY_COLORS = [
	{ bg: "bg-cyan-500", text: "text-cyan-500", light: "bg-cyan-100" },
	{ bg: "bg-green-500", text: "text-green-500", light: "bg-green-100" },
	{ bg: "bg-amber-500", text: "text-amber-500", light: "bg-amber-100" },
	{ bg: "bg-pink-500", text: "text-pink-500", light: "bg-pink-100" },
	{ bg: "bg-blue-500", text: "text-blue-500", light: "bg-blue-100" },
	{ bg: "bg-red-500", text: "text-red-500", light: "bg-red-100" },
	{ bg: "bg-purple-500", text: "text-purple-500", light: "bg-purple-100" },
	{ bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-100" },
];

function getCategoryColor(index: number) {
	return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

interface CategoryRowProps {
	category: AllocationCategory;
	colorIndex: number;
}

function CategoryRow({ category, colorIndex }: CategoryRowProps) {
	const { optimisticallyUpdateBudget, optimisticallyUpdateName, optimisticallyDeleteCategory } = useAllocationContext();

	const [isEditing, setIsEditing] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [budgetValue, setBudgetValue] = useState(category.budget_cap.toString());
	const [nameValue, setNameValue] = useState(category.name);

	const actualSpend = category.actual_spend || 0;
	const utilization = category.budget_cap > 0 ? (actualSpend / category.budget_cap) * 100 : 0;
	const isOverBudget = utilization > 100;
	const color = getCategoryColor(colorIndex);

	const formatCurrency = (value: number) => {
		return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	};

	const handleSave = async () => {
		const newBudget = parseFloat(budgetValue);
		const newName = nameValue.trim();

		let hasError = false;

		if (isNaN(newBudget) || newBudget < 0) {
			toast.error("Please enter a valid budget amount");
			hasError = true;
		}

		if (!newName) {
			toast.error("Category name cannot be empty");
			hasError = true;
		}

		if (hasError) return;

		// Optimistic updates
		optimisticallyUpdateBudget(category.id, newBudget);
		optimisticallyUpdateName(category.id, newName);
		setIsEditing(false);

		// Server updates
		const [budgetSuccess, nameSuccess] = await Promise.all([
			updateCategoryBudget(category.id, newBudget),
			updateCategoryName(category.id, newName),
		]);

		if (budgetSuccess && nameSuccess) {
			toast.success("Category updated");
		} else {
			if (!budgetSuccess) {
				toast.error("Update Failed", {
					description: "Failed to update budget amount. Please try again.",
				});
			}
			if (!nameSuccess) {
				toast.error("Rename Failed", {
					description: "Failed to rename the category. Please try again.",
				});
			}
			// Revert if failed (optional, simplified for now)
		}
	};

	const handleCancel = () => {
		setBudgetValue(category.budget_cap.toString());
		setNameValue(category.name);
		setIsEditing(false);
	};

	const handleConfirmDelete = async () => {
		optimisticallyDeleteCategory(category.id);
		setDeleteDialogOpen(false);

		const success = await deleteCategory(category.id);
		if (success) {
			toast.success("Category deleted");
		} else {
			toast.error("Deletion Failed", {
				description: "Could not delete the category. Please try again.",
			});
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			handleCancel();
		}
	};

	return (
		<>
			<div className="group py-3">
				<div className="flex items-center gap-6">
					<div className="flex-1 flex items-center justify-between">
						{/* Group: Color + Name */}
						<div className="flex items-center gap-3">
							{/* Color indicator */}
							<div className={cn("w-2 h-2 rounded-full flex-shrink-0", color.bg)} />

							{/* Category name */}
							<div className="min-w-[120px]">
								{isEditing ? (
									<Input
										value={nameValue}
										onChange={(e) => setNameValue(e.target.value)}
										onKeyDown={handleKeyDown}
										className="h-7 text-sm font-medium w-48"
										maxLength={100}
										autoFocus
									/>
								) : (
									<span className="text-sm font-medium text-primary text-left">{category.name}</span>
								)}
							</div>
						</div>

						{/* Amount display */}
						<div className="text-right flex-shrink-0">
							{isEditing ? (
								<div className="flex items-center gap-1 justify-end">
									<span className={cn("text-sm font-semibold", isOverBudget ? "text-error" : "text-primary")}>
										{formatCurrency(actualSpend)}
									</span>
									<span className="text-sm text-primary">/</span>
									<Input
										type="number"
										inputMode="decimal"
										value={budgetValue}
										onChange={(e) => setBudgetValue(e.target.value)}
										onKeyDown={handleKeyDown}
										className="h-6 w-20 text-sm"
									/>
								</div>
							) : (
								<span className="text-sm">
									<span className={cn("font-semibold", isOverBudget ? "text-error" : "text-primary")}>
										{formatCurrency(actualSpend)}
									</span>
									<span className="text-primary"> / {formatCurrency(category.budget_cap)}</span>
								</span>
							)}
						</div>
					</div>
					{/* Action buttons */}
					<div
						className={cn(
							"flex items-center gap-1 transition-opacity",
							isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
						)}
					>
						{isEditing ? (
							<>
								<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSave}>
									<Check className="h-3 w-3 text-success" />
								</Button>
								<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancel}>
									<X className="h-3 w-3 text-primary" />
								</Button>
							</>
						) : (
							<>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 text-primary hover:text-primary"
									onClick={() => setIsEditing(true)}
								>
									<Pencil className="h-3 w-3" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 text-primary hover:text-primary"
									onClick={() => setDeleteDialogOpen(true)}
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							</>
						)}
					</div>
				</div>

				{/* Progress bar */}
				<div className="mt-2 ml-5">
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className={cn(
								"h-full rounded-full transition-all duration-500",
								utilization > 100 ? "bg-error" : color.bg
							)}
							style={{ width: `${Math.min(utilization, 100)}%` }}
						/>
					</div>
				</div>
			</div>

			<DeleteCategoryDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleConfirmDelete}
				categoryName={category.name}
				transactionCount={category.transaction_count}
			/>
		</>
	);
}

export function CategoryPerformance({ categories, onAddCategory, className }: CategoryPerformanceProps) {
	if (categories.length === 0) {
		return (
			<Card className={cn("h-full p-6 flex flex-col", className)}>
				<div className="flex items-center justify-between mb-4 flex-shrink-0">
					<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Category Performance</h3>
					<Button size="sm" onClick={onAddCategory} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
						<Plus className="h-4 w-4" />
						Add
					</Button>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-sm text-primary mb-4">No categories yet. Add your first category to start tracking.</p>
						<Button onClick={onAddCategory} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
							<Plus className="h-4 w-4" />
							Add Category
						</Button>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card className={cn("h-full p-6 flex flex-col", className)}>
			<div className="flex items-center justify-between mb-4 flex-shrink-0">
				<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Category Performance</h3>
				<Button variant="outline" size="sm" onClick={onAddCategory} className="gap-1.5">
					<Plus className="h-4 w-4" />
					Add
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto divide-y-0">
				{categories.map((category, index) => (
					<CategoryRow key={category.id} category={category} colorIndex={index} />
				))}
			</div>
		</Card>
	);
}

export { getCategoryColor, CATEGORY_COLORS };
