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
import { validateDecimalInput } from "@/lib/input-utils";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { Switch } from "@/components/ui/switch";

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
	interest_rate?: string;
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
		payment_due_date: account.payment_due_date?.toString() || "",
		credit_limit: account.credit_limit?.toString() || "",
		loan_term_months: account.loan_term_months?.toString() || "",
		track_contribution_room: account.track_contribution_room || false,
		contribution_room: account.contribution_room?.toString() || "",
		annual_contribution_limit: account.annual_contribution_limit?.toString() || "",
	});

	const category = account.account_type?.category;

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

		// Validate Target Goal (optional, but must be a valid number if provided)
		if (!isDebtAccount && formData.target_balance.trim() && isNaN(parseFloat(formData.target_balance))) {
			newErrors.target_balance = "Please enter a valid number";
		}

		// Validate Interest Rate (optional, but must be a valid number if provided)
		if (formData.interest_rate.trim() && isNaN(parseFloat(formData.interest_rate))) {
			newErrors.interest_rate = "Please enter a valid number";
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
				target_balance:
					category === "credit" || category === "debt" || category === "investment" || category === "retirement"
						? null
						: parseFloat(formData.target_balance) || null,
				interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) / 100 : null,
				notes: formData.notes || null,
				payment_due_date: formData.payment_due_date ? parseInt(formData.payment_due_date) : null,
				credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
				loan_term_months: formData.loan_term_months ? parseInt(formData.loan_term_months) : null,
				track_contribution_room: formData.track_contribution_room,
				contribution_room: formData.contribution_room ? parseFloat(formData.contribution_room) : null,
				annual_contribution_limit: formData.annual_contribution_limit
					? parseFloat(formData.annual_contribution_limit)
					: null,
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

					{/* Generic Base Fields */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="current_balance">
								Current Balance <span className="text-error">*</span>
							</Label>
							<Input
								id="current_balance"
								type="text"
								inputMode="decimal"
								placeholder="0.00"
								value={formData.current_balance}
								onChange={(e) => {
									const val = e.target.value;
									if (validateDecimalInput(val)) {
										setFormData({ ...formData, current_balance: val });
										if (errors.current_balance) setErrors({ ...errors, current_balance: undefined });
									}
								}}
								className={errors.current_balance ? "border-error" : ""}
							/>
							{errors.current_balance && <p className="text-sm text-error">{errors.current_balance}</p>}
						</div>

						{(!category ||
							(category !== "credit" &&
								category !== "debt" &&
								category !== "investment" &&
								category !== "retirement")) && (
							<div className="space-y-2">
								<Label htmlFor="target_balance">Target Goal</Label>
								<Input
									id="target_balance"
									type="text"
									inputMode="decimal"
									placeholder="0.00"
									value={formData.target_balance}
									onChange={(e) => {
										const val = e.target.value;
										if (validateDecimalInput(val)) {
											setFormData({ ...formData, target_balance: val });
											if (errors.target_balance) setErrors({ ...errors, target_balance: undefined });
										}
									}}
									className={errors.target_balance ? "border-error" : ""}
								/>
								{errors.target_balance && <p className="text-sm text-error">{errors.target_balance}</p>}
							</div>
						)}
					</div>

					{/* Dynamic Fields based on Category */}
					{category === "credit" && (
						<>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="credit_limit">Credit Limit (Optional)</Label>
									<Input
										id="credit_limit"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 5000"
										value={formData.credit_limit}
										onChange={(e) => {
											const val = e.target.value;
											if (validateDecimalInput(val)) {
												setFormData({ ...formData, credit_limit: val });
											}
										}}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="payment_due_date">Payment Due Date (1-31)</Label>
									<Input
										id="payment_due_date"
										type="number"
										min="1"
										max="31"
										placeholder="e.g., 21"
										value={formData.payment_due_date}
										onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="interest_rate">APR (%)</Label>
								<Input
									id="interest_rate"
									type="text"
									inputMode="decimal"
									placeholder="e.g., 19.99"
									value={formData.interest_rate}
									onChange={(e) => {
										const val = e.target.value;
										if (validateDecimalInput(val)) {
											setFormData({ ...formData, interest_rate: val });
											if (errors.interest_rate) setErrors({ ...errors, interest_rate: undefined });
										}
									}}
									className={errors.interest_rate ? "border-error" : ""}
								/>
								{errors.interest_rate && <p className="text-sm text-error">{errors.interest_rate}</p>}
							</div>
						</>
					)}

					{category === "debt" && (
						<>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="target">Original Loan Amount</Label>
									<Input
										id="target"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 15000"
										value={formData.target_balance}
										onChange={(e) => {
											const val = e.target.value;
											if (validateDecimalInput(val)) {
												setFormData({ ...formData, target_balance: val });
											}
										}}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="loan_term_months">Loan Term (Months)</Label>
									<Input
										id="loan_term_months"
										type="number"
										placeholder="e.g., 60"
										value={formData.loan_term_months}
										onChange={(e) => setFormData({ ...formData, loan_term_months: e.target.value })}
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="payment_due_date">Payment Due Date (1-31)</Label>
									<Input
										id="payment_due_date"
										type="number"
										min="1"
										max="31"
										placeholder="e.g., 15"
										value={formData.payment_due_date}
										onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="interest_rate">APR (%)</Label>
									<Input
										id="interest_rate"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 5.50"
										value={formData.interest_rate}
										onChange={(e) => {
											const val = e.target.value;
											if (validateDecimalInput(val)) {
												setFormData({ ...formData, interest_rate: val });
												if (errors.interest_rate) setErrors({ ...errors, interest_rate: undefined });
											}
										}}
										className={errors.interest_rate ? "border-error" : ""}
									/>
									{errors.interest_rate && <p className="text-sm text-error">{errors.interest_rate}</p>}
								</div>
							</div>
						</>
					)}

					{(category === "investment" || category === "retirement") && (
						<>
							<div className="flex flex-row items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<Label>Track Contribution Room</Label>
									<p className="text-sm text-muted-foreground">
										Track your maximum allowable contributions (e.g., for TFSA, RRSP, FHSA).
									</p>
								</div>
								<Switch
									checked={formData.track_contribution_room}
									onCheckedChange={(checked) => setFormData({ ...formData, track_contribution_room: checked })}
								/>
							</div>

							{formData.track_contribution_room && (
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label htmlFor="contribution_room">Total Contribution Room</Label>
										<Input
											id="contribution_room"
											type="text"
											inputMode="decimal"
											placeholder="e.g., 95000"
											value={formData.contribution_room}
											onChange={(e) => {
												const val = e.target.value;
												if (validateDecimalInput(val)) {
													setFormData({ ...formData, contribution_room: val });
												}
											}}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="annual_limit">Annual Limit</Label>
										<Input
											id="annual_limit"
											type="text"
											inputMode="decimal"
											placeholder="e.g., 7000"
											value={formData.annual_contribution_limit}
											onChange={(e) => {
												const val = e.target.value;
												if (validateDecimalInput(val)) {
													setFormData({ ...formData, annual_contribution_limit: val });
												}
											}}
										/>
									</div>
								</div>
							)}
						</>
					)}

					{(!category ||
						(category !== "credit" &&
							category !== "debt" &&
							category !== "investment" &&
							category !== "retirement")) && (
						<div className="space-y-2">
							<Label htmlFor="interest_rate">APY (%)</Label>
							<Input
								id="interest_rate"
								type="text"
								inputMode="decimal"
								placeholder="e.g., 4.5"
								value={formData.interest_rate}
								onChange={(e) => {
									const val = e.target.value;
									if (validateDecimalInput(val)) {
										setFormData({ ...formData, interest_rate: val });
										if (errors.interest_rate) setErrors({ ...errors, interest_rate: undefined });
									}
								}}
								className={errors.interest_rate ? "border-error" : ""}
							/>
							{errors.interest_rate && <p className="text-sm text-error">{errors.interest_rate}</p>}
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
