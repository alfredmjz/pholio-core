"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createAccount } from "../actions";
import type { CreateAccountInput, AccountType, AccountSubtype } from "../types";

interface AddAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

const assetSubtypes = [
	{ value: "checking", label: "Checking Account" },
	{ value: "savings", label: "Savings Account" },
	{ value: "emergency_fund", label: "Emergency Fund" },
	{ value: "investment", label: "Investment Account" },
	{ value: "retirement", label: "Retirement Account" },
	{ value: "other_asset", label: "Other Asset" },
];

const liabilitySubtypes = [
	{ value: "credit_card", label: "Credit Card" },
	{ value: "personal_loan", label: "Personal Loan" },
	{ value: "student_loan", label: "Student Loan" },
	{ value: "mortgage", label: "Mortgage" },
	{ value: "auto_loan", label: "Auto Loan" },
	{ value: "other_liability", label: "Other Liability" },
];

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
	const [loading, setLoading] = useState(false);
	const [accountType, setAccountType] = useState<AccountType>("asset");
	const [formData, setFormData] = useState<Partial<CreateAccountInput>>({
		type: "asset",
		current_balance: 0,
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const input: CreateAccountInput = {
				name: formData.name!,
				type: accountType,
				subtype: (formData.subtype as AccountSubtype) || null,
				current_balance: formData.current_balance || 0,
				interest_rate: formData.interest_rate || null,
				interest_type: formData.interest_rate ? "compound" : null,
				target_balance: formData.target_balance || null,
				institution_name: formData.institution_name || null,
				notes: formData.notes || null,
			};

			const result = await createAccount(input);

			if (result) {
				toast.success("Account created successfully");
				onOpenChange(false);
				onSuccess();
				// Reset form
				setFormData({ type: "asset", current_balance: 0 });
			} else {
				toast.error("Failed to create account");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const subtypes = accountType === "asset" ? assetSubtypes : liabilitySubtypes;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Add New Account</DialogTitle>
					<DialogDescription>Create a new account to track your assets or liabilities.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Account Type */}
					<div className="space-y-2">
						<Label>Account Type</Label>
						<div className="grid grid-cols-2 gap-2">
							<Button
								type="button"
								variant={accountType === "asset" ? "default" : "outline"}
								onClick={() => {
									setAccountType("asset");
									setFormData({ ...formData, type: "asset", subtype: undefined });
								}}
								className="w-full"
							>
								Asset (Savings, Investments)
							</Button>
							<Button
								type="button"
								variant={accountType === "liability" ? "default" : "outline"}
								onClick={() => {
									setAccountType("liability");
									setFormData({ ...formData, type: "liability", subtype: undefined });
								}}
								className="w-full"
							>
								Liability (Debt, Loans)
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Account Name */}
						<div className="space-y-2">
							<Label htmlFor="name">Account Name *</Label>
							<Input
								id="name"
								placeholder="Emergency Fund"
								value={formData.name || ""}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								required
							/>
						</div>

						{/* Subtype */}
						<div className="space-y-2">
							<Label htmlFor="subtype">Category</Label>
							<Select
								value={formData.subtype || ""}
								onValueChange={(value) => setFormData({ ...formData, subtype: value as AccountSubtype })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select category" />
								</SelectTrigger>
								<SelectContent>
									{subtypes.map((subtype) => (
										<SelectItem key={subtype.value} value={subtype.value}>
											{subtype.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Current Balance */}
						<div className="space-y-2">
							<Label htmlFor="balance">Current Balance *</Label>
							<Input
								id="balance"
								type="number"
								step="0.01"
								placeholder="0.00"
								value={formData.current_balance || ""}
								onChange={(e) => setFormData({ ...formData, current_balance: parseFloat(e.target.value) })}
								required
							/>
						</div>

						{/* Target Balance */}
						<div className="space-y-2">
							<Label htmlFor="target">{accountType === "asset" ? "Target Goal" : "Original Amount"}</Label>
							<Input
								id="target"
								type="number"
								step="0.01"
								placeholder="0.00"
								value={formData.target_balance || ""}
								onChange={(e) => setFormData({ ...formData, target_balance: parseFloat(e.target.value) || null })}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Interest Rate */}
						<div className="space-y-2">
							<Label htmlFor="interest">Interest Rate (APR/APY %)</Label>
							<Input
								id="interest"
								type="number"
								step="0.01"
								placeholder="5.50"
								value={formData.interest_rate ? formData.interest_rate * 100 : ""}
								onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) / 100 || null })}
							/>
						</div>

						{/* Institution */}
						<div className="space-y-2">
							<Label htmlFor="institution">Institution/Lender</Label>
							<Input
								id="institution"
								placeholder="Chase, Ally Bank, etc."
								value={formData.institution_name || ""}
								onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
							/>
						</div>
					</div>

					{/* Notes */}
					<div className="space-y-2">
						<Label htmlFor="notes">Notes</Label>
						<Textarea
							id="notes"
							placeholder="Additional information about this account..."
							value={formData.notes || ""}
							onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
							rows={3}
						/>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
							Cancel
						</Button>
						<Button type="submit" disabled={loading || !formData.name}>
							{loading ? "Creating..." : "Create Account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
