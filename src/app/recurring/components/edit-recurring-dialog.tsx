"use client";

import { useState, useEffect } from "react";
import { updateRecurringExpense, RecurringExpense } from "../actions";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface EditRecurringDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	expense: RecurringExpense | null;
	onSuccess?: (expense: RecurringExpense) => void;
	forceActiveOnSave?: boolean;
}

export function EditRecurringDialog({
	open,
	onOpenChange,
	expense,
	onSuccess,
	forceActiveOnSave,
}: EditRecurringDialogProps) {
	const [formData, setFormData] = useState({
		name: "",
		amount: "",
		billing_period: "monthly",
		next_due_date: new Date(),
		category: "subscription",
		is_automated: true,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	useEffect(() => {
		if (expense) {
			setFormData({
				name: expense.name,
				amount: String(expense.amount),
				billing_period: expense.billing_period,

				next_due_date: forceActiveOnSave
					? new Date()
					: new Date(
							...(expense.next_due_date
								.split("T")[0]
								.split("-")
								.map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))) as [number, number, number])
						),
				category: expense.category,
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

		setIsSubmitting(true);
		try {
			const payload: Partial<RecurringExpense> = {
				name: formData.name,
				amount: amount,
				billing_period: formData.billing_period,
				next_due_date: format(formData.next_due_date, "yyyy-MM-dd"),
				category: formData.category,
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
				toast.error("Update Failed", {
					description: "Failed to update expense. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
			toast.error("Error", {
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
					/>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>
							Amount <span className="text-error">*</span>
						</Label>
						<Input
							type="text"
							inputMode="decimal"
							startAdornment="$"
							value={formData.amount}
							onChange={(e) => {
								const value = e.target.value;
								if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
									setFormData({ ...formData, amount: value });
								}
							}}
							placeholder="0.00"
						/>
					</div>
					<div className="space-y-2">
						<Label>Frequency</Label>
						<Select
							value={formData.billing_period}
							onValueChange={(v) => setFormData({ ...formData, billing_period: v })}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="monthly">Monthly</SelectItem>
								<SelectItem value="yearly">Annually</SelectItem>
								<SelectItem value="weekly">Weekly</SelectItem>
								<SelectItem value="biweekly">Bi-weekly</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>Category</Label>
						<Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="subscription">Subscription</SelectItem>
								<SelectItem value="bill">Bill</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Next Due Date</Label>
						<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
							<PopoverTrigger asChild>
								<Button
									variant={"outline"}
									className={cn(
										"w-full justify-start text-left font-normal",
										!formData.next_due_date && "text-primary"
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{formData.next_due_date ? format(formData.next_due_date, "PPP") : <span>Pick a date</span>}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0">
								<Calendar
									mode="single"
									selected={formData.next_due_date}
									onSelect={(date) => {
										if (date) {
											setFormData({ ...formData, next_due_date: date });
											setIsCalendarOpen(false);
										}
									}}
									autoFocus
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>
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
				</Button>
				<Button onClick={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? "Saving..." : "Save Changes"}
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
