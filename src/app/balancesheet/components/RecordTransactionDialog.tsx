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
import { recordTransaction } from "../actions";
import type { RecordTransactionInput, TransactionType, AccountWithType } from "../types";

interface RecordTransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountWithType | null;
	onSuccess: (accountId: string, amount: number, transactionType: string) => void;
}

export function RecordTransactionDialog({ open, onOpenChange, account, onSuccess }: RecordTransactionDialogProps) {
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState<Partial<RecordTransactionInput>>({
		amount: 0,
		transaction_type: account?.account_type?.class === "asset" ? "deposit" : "payment",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!account) return;

		setLoading(true);

		try {
			const input: RecordTransactionInput = {
				account_id: account.id,
				amount: formData.amount!,
				transaction_type: formData.transaction_type!,
				description: formData.description || null,
				transaction_date: formData.transaction_date || new Date().toISOString().split("T")[0],
			};

			const result = await recordTransaction(input);

			if (result) {
				toast.success("Transaction recorded");
				onOpenChange(false);
				onSuccess(account.id, input.amount, input.transaction_type);
				setFormData({ amount: 0, transaction_type: account.account_type?.class === "asset" ? "deposit" : "payment" });
			} else {
				toast.error("Failed to record transaction");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setLoading(false);
		}
	};

	if (!account) return null;

	const transactionTypes: { value: TransactionType; label: string }[] =
		account.account_type?.class === "asset"
			? [
					{ value: "deposit", label: "Deposit" },
					{ value: "withdrawal", label: "Withdrawal" },
					{ value: "adjustment", label: "Adjustment" },
				]
			: [
					{ value: "payment", label: "Payment" },
					{ value: "adjustment", label: "Adjustment" },
				];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Record Transaction</DialogTitle>
					<DialogDescription>
						{account.account_type?.class === "asset" ? "Record a deposit or withdrawal for" : "Record a payment for"}{" "}
						{account.name}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Transaction Type */}
					<div className="space-y-2">
						<Label htmlFor="type">Transaction Type *</Label>
						<Select
							value={formData.transaction_type || ""}
							onValueChange={(value) => setFormData({ ...formData, transaction_type: value as TransactionType })}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								{transactionTypes.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Amount */}
					<div className="space-y-2">
						<Label htmlFor="amount">Amount *</Label>
						<Input
							id="amount"
							type="number"
							step="0.01"
							placeholder="0.00"
							value={formData.amount || ""}
							onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
							required
						/>
					</div>

					{/* Date */}
					<div className="space-y-2">
						<Label htmlFor="date">Date *</Label>
						<Input
							id="date"
							type="date"
							value={formData.transaction_date || new Date().toISOString().split("T")[0]}
							onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
							required
						/>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							placeholder="Optional description..."
							value={formData.description || ""}
							onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							rows={2}
						/>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
							Cancel
						</Button>
						<Button type="submit" disabled={loading || !formData.amount || formData.amount <= 0}>
							{loading ? "Recording..." : "Record Transaction"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
