"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalTiptap } from "@/components/ui/shadcn-io/minimal-tiptap";
import { updateAccount } from "../../../actions";
import type { AccountWithType } from "../../../types";

interface EditAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountWithType;
	onSuccess: (account: AccountWithType) => void;
}

interface ValidationErrors {
	name?: string;
	current_balance?: string;
	target_balance?: string;
}

export function EditAccountDialog({ open, onOpenChange, account, onSuccess }: EditAccountDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [formData, setFormData] = useState({
		name: account.name,
		institution: account.institution || "",
		current_balance: account.current_balance.toString(),
		target_balance: account.target_balance?.toString() || "",
		interest_rate: account.interest_rate ? (account.interest_rate * 100).toString() : "",
		notes: account.notes || "",
	});

	// Liability accounts (debts) have target goal implicitly as 0
	const isDebtAccount = account.account_type?.class === "liability";

	const validateForm = (): boolean => {
		const newErrors: ValidationErrors = {};

		// Validate Account Name
		if (!formData.name.trim()) {
			newErrors.name = "Account name is required";
		}

		// Validate Current Balance
		if (!formData.current_balance.trim()) {
			newErrors.current_balance = "Current balance is required";
		} else if (isNaN(parseFloat(formData.current_balance))) {
			newErrors.current_balance = "Please enter a valid number";
		}

		// Validate Target Goal (only required for non-debt accounts)
		if (!isDebtAccount) {
			if (!formData.target_balance.trim()) {
				newErrors.target_balance = "Target goal is required";
			} else if (isNaN(parseFloat(formData.target_balance))) {
				newErrors.target_balance = "Please enter a valid number";
			}
		}

		setErrors(newErrors);

		if (Object.keys(newErrors).length > 0) {
			toast.error("Please fill in all required fields", {
				description: "Check the form for displayed errors.",
			});
			return false;
		}
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await updateAccount(account.id, {
				name: formData.name,
				institution: formData.institution || null,
				current_balance: parseFloat(formData.current_balance) || 0,
				target_balance: isDebtAccount ? 0 : parseFloat(formData.target_balance),
				interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) / 100 : null,
				notes: formData.notes || null,
			});

			if (result) {
				toast.success("Account updated successfully");
				onSuccess({
					...account,
					...result,
					account_type: account.account_type,
				});
				onOpenChange(false);
			} else {
				toast.error("Update Failed", {
					description: "Failed to update account details. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Update Error", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl sm:max-w-[650px]">
				<DialogHeader>
					<DialogTitle>Edit Account</DialogTitle>
					<DialogDescription>Update your account details and settings</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					{/* Account Name */}
					<div className="space-y-2">
						<Label htmlFor="name">
							Account Name <span className="text-error">*</span>
						</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) => {
								setFormData({ ...formData, name: e.target.value });
								if (errors.name) setErrors({ ...errors, name: undefined });
							}}
							className={errors.name ? "border-error" : ""}
						/>
						{errors.name && <p className="text-sm text-error">{errors.name}</p>}
					</div>

					{/* Institution */}
					<div className="space-y-2">
						<Label htmlFor="institution">Institution</Label>
						<Input
							id="institution"
							value={formData.institution}
							onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
							placeholder="e.g., Ally Bank"
						/>
					</div>

					{/* Account Type (Read-only display) */}
					<div className="space-y-2">
						<Label>Account Type</Label>
						<div className="h-9 px-3 py-2 text-sm rounded-md border border-border bg-muted">
							{account.account_type?.name}
						</div>
					</div>

					{/* Current Balance & APY */}
					<div className="flex gap-4">
						<div className="flex-1 space-y-2">
							<Label htmlFor="current_balance">
								Current Balance <span className="text-error">*</span>
							</Label>
							<Input
								id="current_balance"
								type="number"
								inputMode="decimal"
								step="0.01"
								value={formData.current_balance}
								onChange={(e) => {
									setFormData({ ...formData, current_balance: e.target.value });
									if (errors.current_balance) setErrors({ ...errors, current_balance: undefined });
								}}
								className={errors.current_balance ? "border-error" : ""}
							/>
							{errors.current_balance && <p className="text-sm text-error">{errors.current_balance}</p>}
						</div>
						<div className="flex-1 space-y-2">
							<Label htmlFor="interest_rate">{isDebtAccount ? "APR (%)" : "APY (%)"}</Label>
							<Input
								id="interest_rate"
								type="number"
								inputMode="decimal"
								step="0.01"
								value={formData.interest_rate}
								onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
								placeholder="e.g., 4.5"
							/>
						</div>
					</div>

					{/* Target Goal (only for non-debt accounts) */}
					{!isDebtAccount && (
						<div className="space-y-2">
							<Label htmlFor="target_balance">
								Target Goal <span className="text-error">*</span>
							</Label>
							<Input
								id="target_balance"
								type="number"
								inputMode="decimal"
								step="0.01"
								value={formData.target_balance}
								onChange={(e) => {
									setFormData({ ...formData, target_balance: e.target.value });
									if (errors.target_balance) setErrors({ ...errors, target_balance: undefined });
								}}
								className={errors.target_balance ? "border-error" : ""}
							/>
							{errors.target_balance && <p className="text-sm text-error">{errors.target_balance}</p>}
						</div>
					)}

					{/* Notes */}
					<div className="space-y-2">
						<Label htmlFor="notes">Notes</Label>
						<MinimalTiptap
							content={formData.notes}
							onChange={(value) => setFormData({ ...formData, notes: value })}
							placeholder="Add notes about this account..."
						/>
					</div>

					<DialogFooter className="flex gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
