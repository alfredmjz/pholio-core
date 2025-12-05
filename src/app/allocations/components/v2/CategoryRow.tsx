"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	ChevronDown,
	ChevronRight,
	Pencil,
	Trash2,
	Check,
	X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCategoryBudget, updateCategoryName, deleteCategory } from "../../actions";
import { toast } from "sonner";
import { useAllocationContext } from "../../context/AllocationContext";
import { DeleteCategoryDialog } from "../DeleteCategoryDialog";
import { TransactionTypeIcon, inferTransactionType } from "./TransactionTypeIcon";
import type { AllocationCategory, Transaction } from "../../types";

interface CategoryRowProps {
	category: AllocationCategory;
	transactions: Transaction[];
	unallocatedFunds: number;
}

export function CategoryRow({
	category,
	transactions,
	unallocatedFunds,
}: CategoryRowProps) {
	const { optimisticallyUpdateBudget, optimisticallyUpdateName, optimisticallyDeleteCategory } =
		useAllocationContext();

	const [isExpanded, setIsExpanded] = useState(false);
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

	// Filter transactions for this category
	const categoryTransactions = transactions.filter(
		(t) => t.category_id === category.id
	);

	// Progress bar color
	const getProgressColor = () => {
		if (utilization <= 60) return "bg-success";
		if (utilization <= 80) return "bg-success";
		if (utilization <= 100) return "bg-warning";
		return "bg-error";
	};

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

	const handleBudgetKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleBudgetSave();
		else if (e.key === "Escape") {
			setBudgetValue(category.budget_cap.toString());
			setIsEditingBudget(false);
		}
	};

	const handleNameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleNameSave();
		else if (e.key === "Escape") {
			setNameValue(category.name);
			setIsEditingName(false);
		}
	};

	return (
		<>
			<div
				className={cn(
					"border border-border rounded-lg overflow-hidden transition-all",
					isOverBudget && "border-error/30 bg-error-muted/30"
				)}
			>
				{/* Main Row */}
				<div
					className={cn(
						"flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors group",
						isExpanded && "bg-muted/30"
					)}
					onClick={() => setIsExpanded(!isExpanded)}
				>
					{/* Expand Icon */}
					<button className="p-1 -ml-1 hover:bg-muted rounded">
						{isExpanded ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
					</button>

					{/* Category Name */}
					<div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
						{isEditingName ? (
							<div className="flex items-center gap-2">
								<Input
									ref={nameInputRef}
									value={nameValue}
									onChange={(e) => setNameValue(e.target.value)}
									onKeyDown={handleNameKeyDown}
									className="h-7 text-sm font-medium max-w-[200px]"
									maxLength={100}
								/>
								<Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleNameSave}>
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
							<div className="flex items-center gap-2">
								<h4 className="text-sm font-semibold text-foreground truncate">
									{category.name}
								</h4>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
									onClick={(e) => {
										e.stopPropagation();
										setIsEditingName(true);
									}}
								>
									<Pencil className="h-3 w-3 text-muted-foreground" />
								</Button>
							</div>
						)}
					</div>

					{/* Badges */}
					<div className="flex items-center gap-2">
						{category.is_recurring && (
							<Badge variant="secondary" className="text-xs">
								Recurring
							</Badge>
						)}
						{categoryTransactions.length > 0 && (
							<Badge variant="outline" className="text-xs">
								{categoryTransactions.length}
							</Badge>
						)}
					</div>

					{/* Progress Section */}
					<div className="flex items-center gap-4 w-[300px]" onClick={(e) => e.stopPropagation()}>
						{/* Spent / Budget */}
						<div className="text-right w-[120px]">
							<span className="text-sm font-semibold text-foreground">
								${actualSpend.toFixed(0)}
							</span>
							<span className="text-sm text-muted-foreground"> / </span>
							{isEditingBudget ? (
								<span className="inline-flex items-center gap-1">
									<span className="text-sm text-muted-foreground">$</span>
									<Input
										ref={budgetInputRef}
										type="number"
										value={budgetValue}
										onChange={(e) => setBudgetValue(e.target.value)}
										onKeyDown={handleBudgetKeyDown}
										className="h-6 w-20 text-sm inline-block"
										step="0.01"
										min="0"
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
								</span>
							) : (
								<button
									className="text-sm text-muted-foreground hover:text-foreground hover:underline"
									onClick={() => setIsEditingBudget(true)}
								>
									${category.budget_cap.toFixed(0)}
								</button>
							)}
						</div>

						{/* Progress Bar */}
						<div className="flex-1 min-w-[100px]">
							<div className="h-2 bg-muted rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full transition-all duration-300 rounded-full",
										getProgressColor()
									)}
									style={{ width: `${Math.min(utilization, 100)}%` }}
								/>
							</div>
						</div>

						{/* Percentage */}
						<div className={cn(
							"text-sm font-medium w-[50px] text-right",
							isOverBudget ? "text-error" : "text-foreground"
						)}>
							{utilization.toFixed(0)}%
						</div>
					</div>

					{/* Delete Button */}
					<Button
						size="sm"
						variant="ghost"
						className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-error"
						onClick={(e) => {
							e.stopPropagation();
							setDeleteDialogOpen(true);
						}}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>

				{/* Expanded Transactions */}
				{isExpanded && (
					<div className="border-t border-border bg-muted/20">
						{categoryTransactions.length === 0 ? (
							<div className="px-4 py-6 text-center text-sm text-muted-foreground">
								No transactions in this category
							</div>
						) : (
							<div className="divide-y divide-border">
								{categoryTransactions.map((transaction) => (
									<div
										key={transaction.id}
										className="flex items-center gap-4 px-4 py-3 pl-12 hover:bg-muted/50"
									>
										{/* Date */}
										<span className="text-sm text-muted-foreground w-[80px]">
											{new Date(transaction.transaction_date).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
											})}
										</span>

										{/* Name */}
										<span className="flex-1 text-sm font-medium text-foreground truncate">
											{transaction.name}
										</span>

										{/* Type Badge */}
										<TransactionTypeIcon
											type={inferTransactionType(transaction)}
											size="sm"
											showLabel
										/>

										{/* Amount */}
										<span className="text-sm font-semibold text-foreground w-[80px] text-right">
											${Math.abs(transaction.amount).toFixed(2)}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				)}
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
