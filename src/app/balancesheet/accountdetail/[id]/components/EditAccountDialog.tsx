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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAccount, getAccountTypes } from "../../../actions";
import type { AccountWithType, AccountType } from "../../../types";

interface EditAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountWithType;
	onSuccess: (account: AccountWithType) => void;
}

export function EditAccountDialog({ open, onOpenChange, account, onSuccess }: EditAccountDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState({
		name: account.name,
		institution: account.institution || "",
		current_balance: account.current_balance.toString(),
		target_balance: account.target_balance?.toString() || "",
		interest_rate: account.interest_rate ? (account.interest_rate * 100).toString() : "",
		notes: account.notes || "",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			const result = await updateAccount(account.id, {
				name: formData.name,
				institution: formData.institution || null,
				current_balance: parseFloat(formData.current_balance) || 0,
				target_balance: formData.target_balance ? parseFloat(formData.target_balance) : null,
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
				toast.error("Failed to update account");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Account</DialogTitle>
					<DialogDescription>Update your account details and settings</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					{/* Account Name */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="name">Account Name</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							required
						/>
					</div>

					{/* Institution */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="institution">Institution</Label>
						<Input
							id="institution"
							value={formData.institution}
							onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
							placeholder="e.g., Ally Bank"
						/>
					</div>

					{/* Account Type (Read-only display) */}
					<div className="flex flex-col gap-2">
						<Label>Account Type</Label>
						<div className="h-9 px-3 py-2 text-sm rounded-md border border-border bg-muted">
							{account.account_type?.name}
						</div>
					</div>

					{/* Current Balance & Target Goal */}
					<div className="flex gap-4">
						<div className="flex-1 flex flex-col gap-2">
							<Label htmlFor="current_balance">Current Balance</Label>
							<Input
								id="current_balance"
								type="number"
								inputMode="decimal"
								step="0.01"
								value={formData.current_balance}
								onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
								required
							/>
						</div>
						<div className="flex-1 flex flex-col gap-2">
							<Label htmlFor="target_balance">Target Goal</Label>
							<Input
								id="target_balance"
								type="number"
								inputMode="decimal"
								step="0.01"
								value={formData.target_balance}
								onChange={(e) => setFormData({ ...formData, target_balance: e.target.value })}
								placeholder="Optional"
							/>
						</div>
					</div>

					{/* APY */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="interest_rate">APY (%)</Label>
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

					{/* Notes */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="notes">Notes</Label>
						<Textarea
							id="notes"
							value={formData.notes}
							onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
							placeholder="Add notes about this account..."
							rows={3}
						/>
					</div>

					<DialogFooter className="gap-2 sm:gap-0">
						<Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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
