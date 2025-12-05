"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { updateCategoryBudget, updateCategoryName, deleteCategory } from "../actions";
import { toast } from "sonner";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import { useAllocationContext } from "../context/AllocationContext";
import type { AllocationCategory, AllocationSummary } from "../types";

interface CategoryCardProps {
	category: AllocationCategory;
	unallocatedFunds: number;
	totalIncome: number;
}

export function CategoryCard({
	category,
	unallocatedFunds,
	totalIncome,
}: CategoryCardProps) {
	const {
		optimisticallyUpdateBudget,
		optimisticallyUpdateName,
		optimisticallyDeleteCategory
	} = useAllocationContext();

	const [isEditingBudget, setIsEditingBudget] = useState(false);
	const [isEditingName, setIsEditingName] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [budgetValue, setBudgetValue] = useState(category.budget_cap.toString());
	const [nameValue, setNameValue] = useState(category.name);
	const budgetInputRef = useRef<HTMLInputElement>(null);
	const nameInputRef = useRef<HTMLInputElement>(null);

	const actualSpend = category.actual_spend || 0;
	const remaining = category.budget_cap - actualSpend;
	const utilization = category.utilization_percentage || 0;

	// Calculate remaining budget if user changes allocation
	const newBudgetNum = parseFloat(budgetValue) || 0;
	const budgetChange = newBudgetNum - category.budget_cap;
	const remainingBudget = unallocatedFunds - budgetChange;

	// Determine progress bar color
	const getProgressColor = () => {
		if (utilization <= 80) return "bg-success";
		if (utilization <= 100) return "bg-warning";
		return "bg-error";
	};

	// Determine card background for over-budget
	const isOverBudget = utilization > 100;

	// Focus input when entering edit mode
	useEffect(() => {
		if (isEditingBudget && budgetInputRef.current) {
			budgetInputRef.current.select();
		}
	}, [isEditingBudget]);

	useEffect(() => {
		if (isEditingName && nameInputRef.current) {
			nameInputRef.current.select();
		}
	}, [isEditingName]);

	const handleBudgetSave = async () => {
		const newBudget = parseFloat(budgetValue);
		if (isNaN(newBudget) || newBudget < 0) {
			toast.error("Please enter a valid budget amount");
			setBudgetValue(category.budget_cap.toString());
			setIsEditingBudget(false);
			return;
		}

		// 1. Optimistically update UI (instant feedback)
		optimisticallyUpdateBudget(category.id, newBudget);
		setIsEditingBudget(false);

		// 2. Send to server
		const success = await updateCategoryBudget(category.id, newBudget);
		if (success) {
			toast.success("Budget updated");
			// Realtime subscription will sync the real data from server
		} else {
			toast.error("Failed to update budget");
			// Note: Realtime will revert to correct value from server
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

		// 1. Optimistically update UI (instant feedback)
		optimisticallyUpdateName(category.id, nameValue.trim());
		setIsEditingName(false);

		// 2. Send to server
		const success = await updateCategoryName(category.id, nameValue.trim());
		if (success) {
			toast.success("Category renamed");
			// Realtime subscription will sync the real data from server
		} else {
			toast.error("Failed to rename category");
			// Note: Realtime will revert to correct value from server
			setNameValue(category.name);
		}
	};

	const handleDelete = () => {
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = async () => {
		// 1. Optimistically update UI (instant feedback)
		optimisticallyDeleteCategory(category.id);
		setDeleteDialogOpen(false);

		// 2. Send to server
		const success = await deleteCategory(category.id);
		if (success) {
			toast.success("Category deleted");
			// Realtime subscription will sync the real data from server
		} else {
			toast.error("Failed to delete category");
			// Note: Realtime will revert to correct value from server
		}
	};

	const handleBudgetKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleBudgetSave();
		} else if (e.key === "Escape") {
			setBudgetValue(category.budget_cap.toString());
			setIsEditingBudget(false);
		}
	};

	const handleNameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleNameSave();
		} else if (e.key === "Escape") {
			setNameValue(category.name);
			setIsEditingName(false);
		}
	};

	return (
		<>
			<Card
				className={`group p-5 hover:shadow-md transition-all duration-200 ${
					isOverBudget ? "border-error/30 bg-error-muted" : "border-border"
				}`}
			>
			{/* Category Name */}
			<div className="flex items-start justify-between mb-3">
				{isEditingName ? (
					<div className="flex items-center gap-2 flex-1">
						<Input
							ref={nameInputRef}
							value={nameValue}
							onChange={(e) => setNameValue(e.target.value)}
							onKeyDown={handleNameKeyDown}
							className="h-7 text-sm font-medium"
							maxLength={100}
						/>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0"
							onClick={handleNameSave}
						>
							<Check className="h-4 w-4 text-success" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0"
							onClick={() => {
								setNameValue(category.name);
								setIsEditingName(false);
							}}
						>
							<X className="h-4 w-4 text-muted-foreground" />
						</Button>
					</div>
				) : (
					<>
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-semibold text-foreground">
								{category.name}
							</h3>
							<Button
								size="sm"
								variant="ghost"
								className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={() => setIsEditingName(true)}
								aria-label={`Edit ${category.name} category name`}
							>
								<Pencil className="h-3 w-3 text-muted-foreground" />
							</Button>
						</div>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0 text-muted-foreground hover:text-error"
							onClick={handleDelete}
							aria-label={`Delete ${category.name} category`}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</>
				)}
			</div>

			{/* Spent vs Budget */}
			<div className="space-y-2 mb-4">
				<div className="flex items-baseline justify-between">
					<div>
						<span className="text-2xl font-bold text-foreground">
							${actualSpend.toFixed(0)}
						</span>
						<span className="text-sm text-muted-foreground ml-1">spent</span>
					</div>
					{isEditingBudget ? (
						<div className="flex items-center gap-2">
							<div className="flex items-center">
								<span className="text-sm text-muted-foreground mr-1">$</span>
								<Input
									ref={budgetInputRef}
									type="number"
									value={budgetValue}
									onChange={(e) => setBudgetValue(e.target.value)}
									onKeyDown={handleBudgetKeyDown}
									className="h-7 w-24 text-sm"
									step="0.01"
									min="0"
								/>
							</div>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 w-7 p-0"
								onClick={handleBudgetSave}
							>
								<Check className="h-4 w-4 text-success" />
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 w-7 p-0"
								onClick={() => {
									setBudgetValue(category.budget_cap.toString());
									setIsEditingBudget(false);
								}}
							>
								<X className="h-4 w-4 text-muted-foreground" />
							</Button>
						</div>
					) : (
						<button
							onClick={() => setIsEditingBudget(true)}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors group/budget"
						>
							Budget:{" "}
							<span className="font-semibold group-hover/budget:underline">
								${category.budget_cap.toFixed(0)}
							</span>
						</button>
					)}
				</div>

				{/* Helper text when editing budget */}
				{isEditingBudget && (
					<div
						className={`text-xs ${
							remainingBudget < 0 ? "text-error" : "text-muted-foreground"
						}`}
					>
						{remainingBudget < 0 ? (
							<span className="flex items-center gap-1">
								<span className="font-medium">⚠</span>
								Over-allocated by ${Math.abs(remainingBudget).toFixed(0)}
							</span>
						) : (
							<span>Remaining budget: ${remainingBudget.toFixed(0)}</span>
						)}
					</div>
				)}

				{/* Progress Bar */}
				<div className="relative h-2 bg-muted rounded-full overflow-hidden">
					<div
						className={`absolute top-0 left-0 h-full ${getProgressColor()} transition-all duration-300 rounded-full`}
						style={{ width: `${Math.min(utilization, 100)}%` }}
					/>
				</div>

				{/* Utilization and Remaining */}
				<div className="flex items-center justify-between text-xs">
					<span
						className={`font-medium ${
							isOverBudget ? "text-error" : "text-foreground"
						}`}
					>
						{utilization.toFixed(0)}% used
					</span>
					<span
						className={`${remaining >= 0 ? "text-success" : "text-error"}`}
					>
						${Math.abs(remaining).toFixed(0)} {remaining >= 0 ? "left" : "over"}
					</span>
				</div>
			</div>

			{/* Badges */}
			<div className="flex items-center gap-2">
				{category.is_recurring && (
					<Badge variant="secondary" className="text-xs">
						Recurring
					</Badge>
				)}
				{category.transaction_count !== undefined && category.transaction_count > 0 && (
					<Badge variant="outline" className="text-xs">
						{category.transaction_count}{" "}
						{category.transaction_count === 1 ? "transaction" : "transactions"}
					</Badge>
				)}
			</div>
			</Card>

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
