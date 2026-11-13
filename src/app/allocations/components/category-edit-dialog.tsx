"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import type { ActionResult } from "@/lib/action-result";
import type { RegisteredPlan } from "@/app/accounts/types";
import {
	deleteCategory,
	updateCategoryBudget,
	updateCategoryColor,
	updateCategoryContributionPlan,
	updateCategoryName,
} from "../actions";
import type { AllocationCategory } from "../types";
import { ContributionPlanPicker } from "./ContributionPlanPicker";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import { CategoryColorPicker } from "./category-color-picker";
import { getCurrencySymbol } from "@/lib/format";

interface CategoryEditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category: AllocationCategory;
	usedColors: string[];
	usedNames: string[];
	contributionPlan: RegisteredPlan | null;
	/** Plans already linked to other categories this month. */
	takenPlans: RegisteredPlan[];
	onContributionPlanChanged?: () => void;
}

/** Rename, re-budget, recolour or link a category; delete lives here too. */
export function CategoryEditDialog({
	open,
	onOpenChange,
	category,
	usedColors,
	usedNames,
	contributionPlan,
	takenPlans,
	onContributionPlanChanged,
}: CategoryEditDialogProps) {
	const [name, setName] = useState(category.name);
	const [budget, setBudget] = useState(String(category.budget_cap));
	const [color, setColor] = useState<string | null>(category.color || null);
	const [plan, setPlan] = useState<RegisteredPlan | null>(contributionPlan);
	const [isSaving, setIsSaving] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	// Start from the saved values each time the dialog opens.
	useEffect(() => {
		if (!open) return;
		setName(category.name);
		setBudget(String(category.budget_cap));
		setColor(category.color || null);
		setPlan(contributionPlan);
	}, [open, category, contributionPlan]);

	const handleSave = async () => {
		const newBudget = parseFloat(budget);
		const newName = name.trim();

		if (!newName) {
			toast.error("Give the category a name");
			return;
		}
		if (isNaN(newBudget) || newBudget < 0) {
			toast.error("Enter a budget of $0 or more");
			return;
		}
		if (
			newName.toLowerCase() !== category.name.toLowerCase() &&
			usedNames.some((n) => n.toLowerCase() === newName.toLowerCase())
		) {
			toast.error("That name is taken", { description: "Another category already uses it." });
			return;
		}

		setIsSaving(true);
		const planChanged = plan !== contributionPlan;
		const unchanged = Promise.resolve<ActionResult<void>>({ ok: true, data: undefined });
		const [budgetResult, nameResult, colorResult, planResult] = await Promise.all([
			newBudget !== category.budget_cap ? updateCategoryBudget(category.id, newBudget) : unchanged,
			newName !== category.name ? updateCategoryName(category.id, newName) : unchanged,
			color && color !== category.color ? updateCategoryColor(category.id, color) : unchanged,
			planChanged ? updateCategoryContributionPlan(category.id, plan) : unchanged,
		]);
		setIsSaving(false);

		if (planChanged && planResult.ok) onContributionPlanChanged?.();

		const failures = (
			[
				["name", nameResult],
				["budget", budgetResult],
				["colour", colorResult],
				["contribution plan", planResult],
			] as const
		).flatMap(([field, result]) => (result.ok ? [] : [{ field, message: result.error.message }]));

		if (failures.length === 0) {
			toast.success("Category saved");
			onOpenChange(false);
			return;
		}
		toast.error("Some changes weren't saved", {
			description: `Couldn't update the ${failures.map((f) => f.field).join(", ")}. ${failures[0].message}`,
		});
	};

	const handleDelete = async () => {
		setDeleteOpen(false);
		const result = await deleteCategory(category.id);
		if (result.ok) {
			toast.success("Category deleted");
			onOpenChange(false);
		} else {
			toast.error("Couldn't delete the category", { description: result.error.message });
		}
	};

	return (
		<>
			<ControlBasedDialog
				open={open}
				onOpenChange={onOpenChange}
				title="Edit category"
				description="Changes apply to this month's budget."
				onEnterSubmit={handleSave}
			>
				<div className="flex flex-col gap-5">
					<div className="space-y-2">
						<Label htmlFor="category-name">Name</Label>
						<Input id="category-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="category-budget">Monthly budget</Label>
						<Input
							id="category-budget"
							type="text"
							inputMode="decimal"
							startAdornment={getCurrencySymbol()}
							value={budget}
							onChange={(e) => setBudget(sanitizeDecimalInput(e.target.value, 2))}
						/>
						{(category.recurring_budget_cap ?? 0) > 0 && (
							<p className="type-body-xs text-muted-foreground">
								Recurring bills in this category add ${category.recurring_budget_cap?.toFixed(2)} on top.
							</p>
						)}
					</div>

					<CategoryColorPicker value={color} onChange={setColor} usedColors={usedColors} ownColor={category.color} />

					<div className="space-y-2">
						<span className="type-label text-primary">Counts toward contribution room</span>
						<ContributionPlanPicker value={plan} onChange={setPlan} takenPlans={takenPlans} allowNone />
						<p className="type-body-xs text-muted-foreground">
							Linked categories track real contributions into that plan&apos;s accounts.
						</p>
					</div>
				</div>

				<DialogFooter className="flex-row items-center justify-between sm:justify-between">
					<Button
						type="button"
						variant="ghost"
						className="gap-2 px-2 text-error hover:bg-error-muted hover:text-error"
						onClick={() => setDeleteOpen(true)}
					>
						<Trash2 className="h-4 w-4" aria-hidden />
						Delete
					</Button>
					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
							Cancel
						</Button>
						<Button type="button" onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</DialogFooter>
			</ControlBasedDialog>

			<DeleteCategoryDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={handleDelete}
				categoryName={category.name}
				transactionCount={category.transaction_count}
			/>
		</>
	);
}
