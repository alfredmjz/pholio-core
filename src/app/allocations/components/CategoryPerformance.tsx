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
	{ bg: "bg-emerald-500", text: "text-emerald-500", light: "bg-emerald-100" },
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

	const [isEditingBudget, setIsEditingBudget] = useState(false);
	const [isEditingName, setIsEditingName] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [budgetValue, setBudgetValue] = useState(category.budget_cap.toString());
	const [nameValue, setNameValue] = useState(category.name);

	const actualSpend = category.actual_spend || 0;
	const utilization = category.budget_cap > 0 ? (actualSpend / category.budget_cap) * 100 : 0;
	const color = getCategoryColor(colorIndex);

	const formatCurrency = (value: number) => {
		return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	};

	const handleBudgetSave = async () => {
		const newBudget = parseFloat(budgetValue);
		if (isNaN(newBudget) || newBudget < 0) {
			toast.error("Please enter a valid budget amount");
			setBudgetValue(category.budget_cap.toString());
			setIsEditingBudget(false);
			return;
		}

		optimisticallyUpdateBudget(category.id, newBudget);
		setIsEditingBudget(false);

		const success = await updateCategoryBudget(category.id, newBudget);
		if (success) {
			toast.success("Budget updated");
		} else {
			toast.error("Failed to update budget");
			setBudgetValue(category.budget_cap.toString());
		}
	};

	const handleNameSave = async () => {
		if (!nameValue.trim()) {
			toast.error("Category name cannot be empty");
			setNameValue(category.name);
			setIsEditingName(false);
			return;
		}

		optimisticallyUpdateName(category.id, nameValue.trim());
		setIsEditingName(false);

		const success = await updateCategoryName(category.id, nameValue.trim());
		if (success) {
			toast.success("Category renamed");
		} else {
			toast.error("Failed to rename category");
			setNameValue(category.name);
		}
	};

	const handleConfirmDelete = async () => {
		optimisticallyDeleteCategory(category.id);
		setDeleteDialogOpen(false);

		const success = await deleteCategory(category.id);
		if (success) {
			toast.success("Category deleted");
		} else {
			toast.error("Failed to delete category");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent, type: "budget" | "name") => {
		if (e.key === "Enter") {
			type === "budget" ? handleBudgetSave() : handleNameSave();
		} else if (e.key === "Escape") {
			if (type === "budget") {
				setBudgetValue(category.budget_cap.toString());
				setIsEditingBudget(false);
			} else {
				setNameValue(category.name);
				setIsEditingName(false);
			}
		}
	};

	return (
		<>
			<div className="group py-3">
				<div className="flex items-center gap-3">
					{/* Color indicator */}
					<div className={cn("w-2 h-2 rounded-full flex-shrink-0", color.bg)} />

					{/* Category name */}
					<div className="flex-1 min-w-0">
						{isEditingName ? (
							<div className="flex items-center gap-2">
								<Input
									value={nameValue}
									onChange={(e) => setNameValue(e.target.value)}
									onKeyDown={(e) => handleKeyDown(e, "name")}
									className="h-7 text-sm font-medium max-w-[150px]"
									maxLength={100}
									autoFocus
								/>
								<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleNameSave}>
									<Check className="h-3 w-3 text-success" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0"
									onClick={() => {
										setNameValue(category.name);
										setIsEditingName(false);
									}}
								>
									<X className="h-3 w-3 text-muted-foreground" />
								</Button>
							</div>
						) : (
							<button
								onClick={() => setIsEditingName(true)}
								className="text-sm font-medium text-foreground hover:underline text-left"
							>
								{category.name}
							</button>
						)}
					</div>

					{/* Amount display */}
					<div className="text-right flex-shrink-0">
						{isEditingBudget ? (
							<div className="flex items-center gap-1">
								<span className="text-sm font-semibold text-foreground">{formatCurrency(actualSpend)}</span>
								<span className="text-sm text-muted-foreground">/</span>
								<Input
									type="number"
									value={budgetValue}
									onChange={(e) => setBudgetValue(e.target.value)}
									onKeyDown={(e) => handleKeyDown(e, "budget")}
									className="h-6 w-20 text-sm"
									autoFocus
								/>
								<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleBudgetSave}>
									<Check className="h-3 w-3 text-success" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0"
									onClick={() => {
										setBudgetValue(category.budget_cap.toString());
										setIsEditingBudget(false);
									}}
								>
									<X className="h-3 w-3 text-muted-foreground" />
								</Button>
							</div>
						) : (
							<button onClick={() => setIsEditingBudget(true)} className="text-sm hover:underline">
								<span className="font-semibold text-foreground">{formatCurrency(actualSpend)}</span>
								<span className="text-muted-foreground"> / {formatCurrency(category.budget_cap)}</span>
							</button>
						)}
					</div>

					{/* Action buttons (visible on hover) */}
					<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
							onClick={() => setIsEditingName(true)}
						>
							<Pencil className="h-3 w-3" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0 text-muted-foreground hover:text-error"
							onClick={() => setDeleteDialogOpen(true)}
						>
							<Trash2 className="h-3 w-3" />
						</Button>
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
					<h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Category Performance</h3>
					<Button variant="outline" size="sm" onClick={onAddCategory} className="gap-1.5">
						<Plus className="h-4 w-4" />
						Add
					</Button>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-sm text-muted-foreground mb-4">
							No categories yet. Add your first category to start tracking.
						</p>
						<Button onClick={onAddCategory} variant="outline" className="gap-2">
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
				<h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Category Performance</h3>
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
