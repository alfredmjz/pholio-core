"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateAccountTransaction, deleteAccountTransaction } from "@/lib/actions/account-transaction-actions";
import type { AccountTransaction } from "@/app/balancesheet/types";
import { FormSection } from "@/components/FormSection";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AccountTransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction: AccountTransaction | null;
	onSuccess?: () => void;
}

export function AccountTransactionDialog({
	open,
	onOpenChange,
	transaction,
	onSuccess,
}: AccountTransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState("");

	useEffect(() => {
		if (open && transaction) {
			setDescription(transaction.description || "");
			setAmount(Math.abs(transaction.amount).toString());
			setDate(transaction.transaction_date.split("T")[0]);
		}
	}, [open, transaction]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!transaction) return;

		if (!amount || !date) {
			toast.error("Please fill in all required fields");
			return;
		}

		setIsLoading(true);

		try {
			const numAmount = parseFloat(amount);

			const success = await updateAccountTransaction(transaction.id, {
				description: description || undefined,
				amount: numAmount,
				transactionDate: date,
			});

			if (success) {
				toast.success("Transaction updated");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error("Update Failed", {
					description: "Failed to update the transaction. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Error", { description: errorMessage });
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!transaction) return;
		setIsDeleting(true);

		try {
			const success = await deleteAccountTransaction(transaction.id);
			if (success) {
				toast.success("Transaction deleted");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error("Delete Failed", {
					description: "Failed to delete the transaction. Please try again.",
				});
			}
		} catch (err) {
			toast.error("Error deleting transaction");
		} finally {
			setIsDeleting(false);
		}
	};

	if (!transaction) return null;

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Edit Transaction"
			description="Modify transaction details below."
			className="sm:max-w-[450px]"
			showCloseButton={false}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-6">
				<FormSection icon={<Info />} title="Transaction Details" variant="subtle">
					<div className="space-y-2">
						<Label htmlFor="amount">Amount</Label>
						<ProminentAmountInput id="amount" value={amount} onChange={setAmount} hasError={false} />
					</div>

					<div className="space-y-2">
						<Label htmlFor="date">Date</Label>
						<DatePicker id="date" value={date} onChange={setDate} placeholder="Select date" />
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">
							Description <span className="text-muted-foreground font-normal">(Optional)</span>
						</Label>
						<Input
							id="description"
							placeholder="e.g. Direct Deposit"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="h-10"
						/>
					</div>
				</FormSection>

				{transaction.linked_allocation_transaction_id && (
					<p className="text-sm text-muted-foreground flex items-start gap-2 p-3 bg-muted rounded-lg">
						<Info className="h-4 w-4 shrink-0 mt-0.5" />
						<span>This transaction is linked to your budget. Changes will update both.</span>
					</p>
				)}

				<DialogFooter className="flex items-center justify-between sm:justify-between w-full">
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button type="button" variant="destructive" size="icon" disabled={isLoading || isDeleting}>
								<Trash2 className="h-4 w-4" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
								<AlertDialogDescription>
									This will permanently delete this transaction and revert the account balance.
									{transaction.linked_allocation_transaction_id &&
										" The linked budget transaction will also be deleted."}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={handleDelete} variant="destructive">
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>

					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Changes
						</Button>
					</div>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
