"use client";

import { useState } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { recordTransaction } from "../actions";
import { AccountWithType, TransactionType } from "../types";

interface AccountAdjustmentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountWithType | null;
	onSuccess: (accountId: string, amount: number, type: string) => void;
}

export function AccountAdjustmentDialog({ open, onOpenChange, account, onSuccess }: AccountAdjustmentDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [type, setType] = useState<TransactionType>("adjustment");
	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");

	if (!account) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!amount || !description) {
			toast.error("Incomplete Form", {
				description: "Please enter both an amount and a description for the adjustment.",
			});
			return;
		}

		setIsLoading(true);
		try {
			const numAmount = parseFloat(amount);
			const result = await recordTransaction({
				account_id: account.id,
				amount: numAmount,
				transaction_type: type,
				description,
			});

			if (result) {
				toast.success("Balance adjusted successfully");
				onSuccess(account.id, numAmount, type);
				onOpenChange(false);
				// Reset form
				setAmount("");
				setDescription("");
				setType("adjustment");
			} else {
				toast.error("Adjustment Failed", {
					description: "Could not record the balance adjustment. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Adjustment Error", {
				description: errorMessage,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const transactionTypes: { value: TransactionType; label: string }[] =
		account.account_type?.class === "asset"
			? [
					{ value: "adjustment", label: "Adjustment" },
					{ value: "deposit", label: "Manual Deposit" },
					{ value: "withdrawal", label: "Manual Withdrawal" },
				]
			: [
					{ value: "adjustment", label: "Adjustment" },
					{ value: "payment", label: "Manual Payment" },
				];

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Adjust Balance"
			description="Record a manual balance adjustment or historical transaction without affecting your budget categories."
		>
			<form onSubmit={handleSubmit} className="space-y-4 py-2">
				{/* Type Selector */}
				<div className="space-y-2">
					<Label htmlFor="type">Adjustment Type</Label>
					<Select value={type} onValueChange={(val) => setType(val as TransactionType)}>
						<SelectTrigger>
							<SelectValue placeholder="Select type" />
						</SelectTrigger>
						<SelectContent>
							{transactionTypes.map((t) => (
								<SelectItem key={t.value} value={t.value}>
									{t.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Amount */}
				<div className="space-y-2">
					<Label htmlFor="amount">Amount</Label>
					<div className="relative">
						<span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">$</span>
						<Input
							id="amount"
							type="number"
							inputMode="decimal"
							step="0.01"
							placeholder="0.00"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							className="pl-7"
							required
						/>
					</div>
				</div>

				{/* Description */}
				<div className="space-y-2">
					<Label htmlFor="description">Description (Reason)</Label>
					<Input
						id="description"
						placeholder="e.g. Interest, Correction, Opening Balance"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						required
					/>
				</div>

				<div className="flex justify-end gap-2 pt-4">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
						Cancel
					</Button>
					<Button type="submit" disabled={isLoading}>
						{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Adjust Balance
					</Button>
				</div>
			</form>
		</ControlBasedDialog>
	);
}
