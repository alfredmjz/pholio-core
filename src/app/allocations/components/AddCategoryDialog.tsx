"use client";

import { useState, useEffect } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CATEGORY_PALETTE, COLOR_NAME_MAP, getNextAvailableColor } from "../utils/colors";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface AddCategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (name: string, budgetCap: number, color?: string) => void;
	unallocatedFunds: number;
	usedColors?: string[];
	usedNames?: string[];
}

export function AddCategoryDialog({
	open,
	onOpenChange,
	onSubmit,
	unallocatedFunds,
	usedColors = [],
	usedNames = [],
}: AddCategoryDialogProps) {
	const [name, setName] = useState("");
	const [budgetCap, setBudgetCap] = useState("");
	const [selectedColor, setSelectedColor] = useState<string | null>(null);
	const [nameError, setNameError] = useState("");
	const [budgetError, setBudgetError] = useState("");

	useEffect(() => {
		if (!open) {
			setName("");
			setBudgetCap("");
			setSelectedColor(null);
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

		const isDuplicate = usedNames.some((n) => n.toLowerCase() === value.trim().toLowerCase());
		if (isDuplicate) {
			setNameError("A category with this name already exists");
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
			const finalColor = selectedColor || getNextAvailableColor(usedColors);
			onSubmit(name.trim(), parseFloat(budgetCap), finalColor);
			onOpenChange(false);
		}
	};

	const isFormValid =
		name.trim().length > 0 &&
		name.trim().length <= 100 &&
		budgetCap.length > 0 &&
		!isNaN(parseFloat(budgetCap)) &&
		parseFloat(budgetCap) >= 0 &&
		(!selectedColor || !usedColors.includes(selectedColor)) &&
		!usedNames.some((n) => n.toLowerCase() === name.trim().toLowerCase());

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

					<div className="grid gap-2">
						<Label htmlFor="budget-cap">
							Budget Cap <span className="text-error">*</span>
						</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">$</span>
							<Input
								id="budget-cap"
								type="number"
								inputMode="decimal"
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
								<span>This exceeds your unallocated funds by {(budgetNum - unallocatedFunds).toFixed(2)}</span>
							</p>
						)}
						{!budgetError && !isOverAllocated && budgetNum > 0 && (
							<p className="text-xs text-primary" aria-describedby="budget-cap">
								You have ${unallocatedFunds.toFixed(2)} unallocated
							</p>
						)}
					</div>

					<div className="grid gap-2">
						<Label>Category Color</Label>
						<div className="flex flex-wrap gap-2 pt-1">
							{CATEGORY_PALETTE.map((color) => {
								const colorName = Object.keys(COLOR_NAME_MAP).find(
									(key) => COLOR_NAME_MAP[key] === CATEGORY_PALETTE.indexOf(color)
								);
								if (!colorName) return null;

								const isSelected = selectedColor === colorName;
								const isUsed = usedColors.includes(colorName);

								return (
									<button
										key={colorName}
										type="button"
										onClick={() => setSelectedColor(colorName)}
										disabled={isUsed}
										className={cn(
											"w-8 h-8 rounded-full transition-all border-2 relative",
											color.bg,
											isSelected ? "border-primary scale-110 shadow-sm" : "border-transparent",
											isUsed ? "opacity-30 cursor-not-allowed" : "hover:scale-105"
										)}
										title={isUsed ? `${colorName} (Already in use)` : colorName}
									>
										{isSelected && (
											<div className="w-full h-full flex items-center justify-center">
												<div className="w-2 h-2 rounded-full bg-white shadow-sm" />
											</div>
										)}
										{isUsed && (
											<div className="absolute inset-0 flex items-center justify-center">
												<div className="w-[1px] h-[80%] bg-white/50 rotate-45" />
											</div>
										)}
									</button>
								);
							})}
						</div>
						{selectedColor && usedColors.includes(selectedColor) && (
							<p className="text-xs text-error mt-1 flex items-center gap-1">
								<AlertCircle className="h-3 w-3" />
								This color is already in use by another category.
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
