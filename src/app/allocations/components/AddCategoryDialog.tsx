"use client";

import { useState, useEffect } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { CATEGORY_PALETTE, COLOR_NAME_MAP, getNextAvailableColor } from "../utils/colors";
import { AlertTriangle } from "lucide-react";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import { ContributionPlanPicker } from "./ContributionPlanPicker";
import { ContributionRoomMeter } from "./ContributionRoomMeter";
import { CategoryColorPicker } from "./category-color-picker";
import type { RegisteredPlan } from "@/app/accounts/types";
import type { ContributionSummary } from "@/lib/types/contribution";
import { formatMoney, getCurrencySymbol } from "@/lib/format";

interface AddCategoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (name: string, budgetCap: number, color?: string, contributionPlan?: RegisteredPlan | null) => void;
	unallocatedFunds: number;
	usedColors?: string[];
	usedNames?: string[];
	/** Contribution room per plan, for the live preview. */
	contributionPools?: ContributionSummary[];
	/** Plans already linked to a category this month. */
	linkedPlans?: RegisteredPlan[];
	year: number;
}

const formatPreviewCurrency = (value: number) => formatMoney(value);

export function AddCategoryDialog({
	open,
	onOpenChange,
	onSubmit,
	unallocatedFunds,
	usedColors = [],
	usedNames = [],
	contributionPools = [],
	linkedPlans = [],
	year,
}: AddCategoryDialogProps) {
	const [name, setName] = useState("");
	const [budgetCap, setBudgetCap] = useState("");
	const [selectedColor, setSelectedColor] = useState<string | null>(null);
	const [nameError, setNameError] = useState("");
	const [budgetError, setBudgetError] = useState("");
	const [tracksRoom, setTracksRoom] = useState(false);
	const [contributionPlan, setContributionPlan] = useState<RegisteredPlan | null>(null);

	useEffect(() => {
		if (!open) {
			setName("");
			setBudgetCap("");
			setSelectedColor(null);
			setNameError("");
			setBudgetError("");
			setTracksRoom(false);
			setContributionPlan(null);
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
			onSubmit(name.trim(), parseFloat(budgetCap), finalColor, tracksRoom ? contributionPlan : null);
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
		!usedNames.some((n) => n.toLowerCase() === name.trim().toLowerCase()) &&
		(!tracksRoom || contributionPlan !== null);

	const budgetNum = parseFloat(budgetCap) || 0;
	const isOverAllocated = budgetNum > unallocatedFunds;
	const previewColorName = selectedColor || getNextAvailableColor(usedColors);
	const previewColor = CATEGORY_PALETTE[COLOR_NAME_MAP[previewColorName] ?? 0];

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Add category"
			description="Give part of this month's income a job."
		>
			<form onSubmit={handleSubmit}>
				<div className="grid gap-5">
					<div className="grid gap-2">
						<Label htmlFor="category-name">
							Name <span className="text-error">*</span>
						</Label>
						<Input
							id="category-name"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (nameError) validateName(e.target.value);
							}}
							onBlur={(e) => validateName(e.target.value)}
							placeholder="e.g. Groceries"
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
							Monthly budget <span className="text-error">*</span>
						</Label>
						<div>
							<Input
								startAdornment={getCurrencySymbol()}
								id="budget-cap"
								type="text"
								inputMode="decimal"
								value={budgetCap}
								onChange={(e) => {
									const val = sanitizeDecimalInput(e.target.value, 2);
									setBudgetCap(val);
									if (budgetError) validateBudget(val);
								}}
								onBlur={(e) => validateBudget(e.target.value)}
								placeholder="0.00"
								className={budgetError ? "border-error" : ""}
							/>
						</div>
						{budgetError && (
							<p className="text-xs text-error" role="alert">
								{budgetError}
							</p>
						)}
						{!budgetError && isOverAllocated && (
							<p className="type-body-xs flex items-center gap-1.5 text-warning" role="alert">
								<AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />$
								{(budgetNum - unallocatedFunds).toFixed(2)} more than the income you haven&apos;t budgeted yet
							</p>
						)}
						{!budgetError && !isOverAllocated && budgetNum > 0 && (
							<p className="type-body-xs text-muted-foreground" aria-describedby="budget-cap">
								${unallocatedFunds.toFixed(2)} of this month&apos;s income isn&apos;t budgeted yet
							</p>
						)}
					</div>

					<div className="grid gap-3 rounded-2xl border border-border/70 bg-card-muted/40 p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="space-y-0.5">
								<Label htmlFor="category-track-room">Count toward contribution room</Label>
								<p className="type-caption text-muted-foreground">
									Shows this budget against your TFSA, RRSP, FHSA or RESP room. Only real deposits use the room.
								</p>
							</div>
							<Switch id="category-track-room" checked={tracksRoom} onCheckedChange={setTracksRoom} />
						</div>
						{tracksRoom && (
							<>
								<ContributionPlanPicker
									value={contributionPlan}
									onChange={setContributionPlan}
									takenPlans={linkedPlans}
								/>
								{contributionPlan ? (
									<ContributionRoomMeter
										plan={contributionPlan}
										pool={contributionPools.find((pool) => pool.pool_key === contributionPlan)}
										budget={budgetNum}
										color={previewColor}
										year={year}
										formatCurrency={formatPreviewCurrency}
									/>
								) : (
									<p className="type-caption text-muted-foreground">Choose the plan this budget goes into.</p>
								)}
							</>
						)}
					</div>

					<CategoryColorPicker
						value={selectedColor}
						onChange={setSelectedColor}
						usedColors={usedColors}
						fallback={previewColorName}
					/>
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
						<CancelShortcut />
					</Button>
					<Button type="submit" disabled={!isFormValid}>
						Add category
						<SubmitShortcut />
					</Button>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
