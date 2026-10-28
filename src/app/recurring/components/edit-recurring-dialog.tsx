"use client";

import { useState, useEffect } from "react";
import { updateRecurringExpense, RecurringExpense } from "../actions";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { formatDateString, parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { sanitizePositiveIntegerInput } from "@/lib/input-utils";
import type { AccountWithType } from "@/app/accounts/types";
import { NO_ACCOUNT, RecurringAccountField } from "./recurring-account-field";

interface EditRecurringDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	expense: RecurringExpense | null;
	onSuccess?: (expense: RecurringExpense) => void;
	forceActiveOnSave?: boolean;
	/** Allocation category names to choose from; empty falls back to Subscriptions/Bills. */
	categoryOptions?: string[];
	accounts?: AccountWithType[];
}

export function EditRecurringDialog({
	open,
	onOpenChange,
	expense,
	onSuccess,
	forceActiveOnSave,
	categoryOptions = [],
	accounts = [],
}: EditRecurringDialogProps) {
	const [formData, setFormData] = useState({
		name: "",
		amount: "",
		frequency_value: "1",
		frequency_unit: "months",
		next_due_date: new Date(),
		category: "subscription",
		budget_category: "__default__",
		account_id: NO_ACCOUNT,
		is_automated: true,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (expense) {
			const [val, unit] = expense.billing_period.includes(":")
				? expense.billing_period.split(":")
				: [
						expense.billing_period === "biweekly" ? "2" : "1",
						expense.billing_period === "biweekly"
							? "weeks"
							: expense.billing_period === "yearly"
								? "years"
								: expense.billing_period === "weekly"
									? "weeks"
									: "months",
					];

			setFormData({
				name: expense.name,
				amount: String(expense.amount),
				frequency_value: val,
				frequency_unit: unit,
				next_due_date: forceActiveOnSave
					? new Date()
					: new Date(
							...(expense.next_due_date
								.split("T")[0]
								.split("-")
								.map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))) as [number, number, number])
						),
				category: expense.category,
				budget_category: expense.budget_category ?? "__default__",
				account_id: expense.account_id ?? NO_ACCOUNT,
				is_automated: (expense.meta_data as any)?.is_automated !== false,
			});
		}
	}, [expense, forceActiveOnSave]);

	const handleSubmit = async () => {
		if (!expense) return;

		if (!formData.name.trim()) {
			toast.error("Name is required", {
				description: "Please enter a name for this recurring expense.",
			});
			return;
		}

		if (!formData.amount) {
			toast.error("Amount is required", {
				description: "Please enter an amount for this recurring expense.",
			});
			return;
		}

		const amountRegex = /^\d+(\.\d{1,2})?$/;
		if (!amountRegex.test(formData.amount)) {
			toast.error("Invalid amount", {
				description: "Please enter a valid number with up to 2 decimal places (e.g., 9.99).",
			});
			return;
		}

		const amount = parseFloat(formData.amount);
		if (amount <= 0) {
			toast.error("Invalid amount", {
				description: "Amount must be greater than zero.",
			});
			return;
		}

		// The field may be empty while typing; it only has to be a whole number of at least 1 on submit.
		const frequencyValue = parseInt(formData.frequency_value, 10);
		if (!(frequencyValue >= 1)) {
			toast.error("Invalid frequency", {
				description: "Frequency must be a whole number of at least 1.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			const payload: Partial<RecurringExpense> = {
				name: formData.name,
				amount: amount,
				billing_period: `${frequencyValue}:${formData.frequency_unit}`,
				next_due_date: formatDateString(formData.next_due_date),
				category: formData.category,
				budget_category: formData.budget_category === "__default__" ? null : formData.budget_category,
				account_id: formData.account_id === NO_ACCOUNT ? null : formData.account_id,
				meta_data: {
					...(expense.meta_data as any),
					is_automated: formData.is_automated,
				},
			};

			if (forceActiveOnSave) {
				payload.is_active = true;
			}

			const success = await updateRecurringExpense(expense.id, payload);

			if (success) {
				toast.success(forceActiveOnSave ? "Subscription reactivated" : "Recurring expense updated");
				onSuccess?.({
					...expense,
					...payload,

					amount: amount,
				} as RecurringExpense);
				onOpenChange(false);
			} else {
				toast.error("Couldn't save your changes", {
					description: "Failed to update expense. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
			toast.error("Something went wrong", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!expense) return null;

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Edit Recurring Expense"
			description="Update the details for this recurring expense."
			className="sm:max-w-[500px]"
			onEnterSubmit={handleSubmit}
		>
			<div className="space-y-4 py-4">
				<div className="space-y-2">
					<Label>
						Name <span className="text-error">*</span>
					</Label>
					<Input
						value={formData.name}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						placeholder="Netflix, Rent, etc."
						className="h-10"
					/>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label>
							Amount <span className="text-error">*</span>
						</Label>
						<ProminentAmountInput
							value={formData.amount}
							onChange={(val) => setFormData({ ...formData, amount: val })}
							hasError={false}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="frequency-value">Frequency</Label>
						<div className="flex gap-2">
							<Input
								type="text"
								id="frequency-value"
								inputMode="numeric"
								value={formData.frequency_value}
								onChange={(e) => {
									const val = sanitizePositiveIntegerInput(e.target.value);
									setFormData({ ...formData, frequency_value: val });
								}}
								className="h-10 w-20"
							/>
							<Select
								value={formData.frequency_unit}
								onValueChange={(v) => setFormData({ ...formData, frequency_unit: v })}
							>
								<SelectTrigger className="h-10 flex-1">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="days">Days</SelectItem>
									<SelectItem value="weeks">Weeks</SelectItem>
									<SelectItem value="months">Months</SelectItem>
									<SelectItem value="years">Years</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label>Category</Label>
						<Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
							<SelectTrigger className="h-10">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="bill">Bill</SelectItem>
								<SelectItem value="subscription">Subscription</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="next-due-date">Next Due Date</Label>
						<DatePicker
							id="next-due-date"
							value={formatDateString(formData.next_due_date)}
							onChange={(date) => setFormData({ ...formData, next_due_date: parseLocalDate(date) })}
							yearPicker
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label>Budget category</Label>
					<Select
						value={formData.budget_category}
						onValueChange={(v) => setFormData({ ...formData, budget_category: v })}
					>
						<SelectTrigger className="h-10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__default__">
								Default ({formData.category === "bill" ? "Bills" : "Subscriptions"})
							</SelectItem>
							{categoryOptions.map((name) => (
								<SelectItem key={name} value={name}>
									{name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">Which budget category this recurring expense is added to.</p>
				</div>
				<RecurringAccountField
					id="edit-recurring-account"
					value={formData.account_id}
					onChange={(v) => setFormData({ ...formData, account_id: v })}
					accounts={accounts}
				/>
				{formData.category === "bill" && (
					<div className="flex items-center justify-between space-x-2 pt-2">
						<div className="flex flex-col gap-1">
							<Label htmlFor="edit-auto-pay" className="leading-none">
								Auto-pay
							</Label>
							<span className="text-xs text-muted-foreground">Automatically create transactions</span>
						</div>
						<Switch
							id="edit-auto-pay"
							checked={formData.is_automated}
							onCheckedChange={(checked) => setFormData({ ...formData, is_automated: checked })}
						/>
					</div>
				)}
			</div>

			<DialogFooter>
				<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
					Cancel
					<CancelShortcut />
				</Button>
				<Button onClick={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? "Saving..." : "Save Changes"}
					<SubmitShortcut />
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
