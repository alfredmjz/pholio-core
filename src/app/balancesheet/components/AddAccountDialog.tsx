"use client";

import { useState, useEffect } from "react";
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
import { CompactTiptap } from "@/components/ui/shadcn-io/compact-tiptap";
import { toast } from "sonner";
import { createAccount, getAccountTypes } from "../actions";
import type { CreateAccountInput, AccountType, AccountClass, AccountWithType } from "../types";

interface AddAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: (account: AccountWithType) => void;
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
	const [loading, setLoading] = useState(false);
	const [accountType, setAccountType] = useState<AccountClass>("asset");
	const [allAccountTypes, setAllAccountTypes] = useState<any[]>([]);
	const [formData, setFormData] = useState<Partial<CreateAccountInput>>({
		current_balance: 0,
	});

	// Fetch account types on mount
	useEffect(() => {
		const fetchTypes = async () => {
			const types = await getAccountTypes();
			setAllAccountTypes(types);
		};
		fetchTypes();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const input: CreateAccountInput = {
				name: formData.name!,
				account_type_id: formData.account_type_id!,
				current_balance: formData.current_balance || 0,
				interest_rate: formData.interest_rate || null,
				interest_type: formData.interest_rate ? "compound" : null,
				target_balance: formData.target_balance || null,
				institution: formData.institution || null,
				notes: formData.notes || null,
			};

			const result = await createAccount(input);

			if (result) {
				toast.success("Account created successfully");
				onOpenChange(false);
				onSuccess(result);
				// Reset form
				setFormData({ current_balance: 0 });
			} else {
				toast.error("Failed to create account");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const availableTypes = allAccountTypes.filter((t) => t.class === accountType);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
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
									setFormData({ ...formData, account_type_id: undefined });
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
									setFormData({ ...formData, account_type_id: undefined });
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

						{/* Account Type (Category) */}
						<div className="space-y-2">
							<Label htmlFor="type-id">Category</Label>
							<Select
								value={formData.account_type_id || ""}
								onValueChange={(value) => setFormData({ ...formData, account_type_id: value })}
							>
								<SelectTrigger id="type-id">
									<SelectValue placeholder="Select category" />
								</SelectTrigger>
								<SelectContent>
									{availableTypes.map((type) => (
										<SelectItem key={type.id} value={type.id}>
											{type.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Current Balance */}
						<div className="space-y-2">
							<Label htmlFor="balance">Current Balance</Label>
							<Input
								id="balance"
								type="number"
								step="0.01"
								placeholder="0.00"
								value={formData.current_balance ?? ""}
								onChange={(e) =>
									setFormData({ ...formData, current_balance: e.target.value ? parseFloat(e.target.value) : 0 })
								}
							/>
						</div>

						{/* Target Balance */}
						<div className="space-y-2">
							<Label htmlFor="target">{accountType === "asset" ? "Target Goal *" : "Original Amount"}</Label>
							<Input
								id="target"
								type="number"
								step="0.01"
								placeholder="0.00"
								value={formData.target_balance || ""}
								onChange={(e) => setFormData({ ...formData, target_balance: parseFloat(e.target.value) || null })}
								required={accountType === "asset"}
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
								value={formData.institution || ""}
								onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
							/>
						</div>
					</div>

					{/* Notes */}
					<div className="space-y-2">
						<Label>Notes</Label>
						<CompactTiptap
							content={formData.notes || ""}
							onChange={(content) => setFormData({ ...formData, notes: content })}
							placeholder="Additional information about this account..."
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
