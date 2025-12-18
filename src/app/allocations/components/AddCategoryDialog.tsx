"use client";

import { useState, useEffect } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddCategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (name: string, budgetCap: number) => void;
	unallocatedFunds: number;
}

export function AddCategoryDialog({ open, onOpenChange, onSubmit, unallocatedFunds }: AddCategoryDialogProps) {
	const [name, setName] = useState("");
	const [budgetCap, setBudgetCap] = useState("");
	const [nameError, setNameError] = useState("");
	const [budgetError, setBudgetError] = useState("");

	// Reset form when dialog opens/closes
	useEffect(() => {
		if (!open) {
			setName("");
			setBudgetCap("");
			setNameError("");
			setBudgetError("");
		}
	}, [open]);

	const validateName = (value: string): boolean => {
		if (!value.trim()) {
			setNameError("Category name is required");
			return false;
		}
		if (value.trim().length > 100) {
			setNameError("Category name must be 100 characters or less");
			return false;
		}
		setNameError("");
		return true;
	};

	const validateBudget = (value: string): boolean => {
		const numValue = parseFloat(value);
		if (!value || isNaN(numValue)) {
			setBudgetError("Budget amount is required");
			return false;
		}
		if (numValue < 0) {
			setBudgetError("Budget must be a positive number");
			return false;
		}
		setBudgetError("");
		return true;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const isNameValid = validateName(name);
		const isBudgetValid = validateBudget(budgetCap);

		if (isNameValid && isBudgetValid) {
			onSubmit(name.trim(), parseFloat(budgetCap));
			onOpenChange(false);
		}
	};

	const isFormValid =
		name.trim().length > 0 &&
		name.trim().length <= 100 &&
		budgetCap.length > 0 &&
		!isNaN(parseFloat(budgetCap)) &&
		parseFloat(budgetCap) >= 0;

	const budgetNum = parseFloat(budgetCap) || 0;
	const isOverAllocated = budgetNum > unallocatedFunds;

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Add Category"
			description="Create a new budget category to track your spending."
			className="sm:max-w-[425px]"
		>
			<form onSubmit={handleSubmit}>
					<div className="grid gap-4 py-4">
						{/* Category Name */}
						<div className="grid gap-2">
							<Label htmlFor="category-name">
								Category Name <span className="text-error">*</span>
							</Label>
							<Input
								id="category-name"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									if (nameError) validateName(e.target.value);
								}}
								onBlur={(e) => validateName(e.target.value)}
								placeholder="e.g., Housing, Groceries, Entertainment"
								maxLength={100}
								className={nameError ? "border-error" : ""}
							/>
							{nameError && (
								<p className="text-xs text-error" role="alert">
									{nameError}
								</p>
							)}
						</div>

						{/* Budget Cap */}
						<div className="grid gap-2">
							<Label htmlFor="budget-cap">
								Budget Cap <span className="text-error">*</span>
							</Label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
								<Input
									id="budget-cap"
									type="number"
									value={budgetCap}
									onChange={(e) => {
										setBudgetCap(e.target.value);
										if (budgetError) validateBudget(e.target.value);
									}}
									onBlur={(e) => validateBudget(e.target.value)}
									placeholder="0.00"
									step="0.01"
									min="0"
									className={`pl-7 ${budgetError ? "border-error" : ""}`}
								/>
							</div>
							{budgetError && (
								<p className="text-xs text-error" role="alert">
									{budgetError}
								</p>
							)}
							{!budgetError && isOverAllocated && (
								<p className="text-xs text-warning flex items-center gap-1" role="alert">
									<span>⚠</span>
									<span>This exceeds your unallocated funds by ${(budgetNum - unallocatedFunds).toFixed(2)}</span>
								</p>
							)}
							{!budgetError && !isOverAllocated && budgetNum > 0 && (
								<p className="text-xs text-muted-foreground" aria-describedby="budget-cap">
									You have ${unallocatedFunds.toFixed(2)} unallocated
								</p>
							)}
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={!isFormValid}>
							Add Category
						</Button>
					</DialogFooter>
				</form>
		</ControlBasedDialog>
	);
}
