"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowUpRight, Loader2, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateAccountTransaction, deleteAccountTransaction } from "@/lib/actions/account-transaction-actions";
import { getTransactionDescriptions } from "@/lib/actions/unified-transaction-actions";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import type { AccountTransaction } from "@/app/accounts/types";
import { accountHref, allocationsHref, transferDirection } from "@/lib/account-links";
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
	isLiability?: boolean;
}

export function AccountTransactionDialog({
	open,
	onOpenChange,
	transaction,
	onSuccess,
	isLiability = false,
}: AccountTransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState("");
	const [suggestions, setSuggestions] = useState<string[]>([]);

	useEffect(() => {
		if (open && transaction) {
			setDescription(transaction.description || "");
			setAmount(Math.abs(transaction.amount).toString());
			setDate(transaction.transaction_date.split("T")[0]);
		}
		if (open) {
			getTransactionDescriptions().then(setSuggestions);
		}
	}, [open, transaction]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!transaction) return;

		if (!amount || !date || !description.trim()) {
			toast.error("Fill in the required fields");
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
				toast.error("Couldn't save the transaction", {
					description: "Failed to update the transaction. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Something went wrong", { description: errorMessage });
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
				toast.error("Couldn't delete the transaction", {
					description: "Failed to delete the transaction. Please try again.",
				});
			}
		} catch (err) {
			toast.error("Couldn't delete the transaction");
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
							Description <span className="text-error">*</span>
						</Label>
						<AutocompleteInput
							id="description"
							placeholder="e.g. Direct Deposit"
							value={description}
							onChange={setDescription}
							suggestions={suggestions}
							required
							className="h-10"
						/>
					</div>
				</FormSection>

				{(transaction.linked_allocation_transaction_id || transaction.transfer_account) && (
					<div className="flex flex-col gap-3 rounded-lg bg-muted p-3">
						<div className="type-body-sm flex items-start gap-2 text-muted-foreground">
							<Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<div className="flex flex-col gap-1">
								{transaction.transfer_account && (
									<span>
										{transferDirection(transaction.amount, isLiability) === "to" ? "Sent to" : "Received from"}{" "}
										<span className="text-primary">{transaction.transfer_account.label}</span>.
									</span>
								)}
								{transaction.linked_allocation_transaction_id && (
									<span>This transaction is linked to your budget.</span>
								)}
							</div>
						</div>
						{(transaction.budget_link || transaction.transfer_account) && (
							<div className="flex flex-wrap gap-2 pl-6">
								{transaction.budget_link && (
									<Button asChild variant="outline" size="sm" className="h-11 rounded-full sm:h-9">
										<Link
											href={allocationsHref(transaction.budget_link.transaction_date, transaction.budget_link.id)}
											onClick={() => onOpenChange(false)}
										>
											View in Allocations
											<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
										</Link>
									</Button>
								)}
								{transaction.transfer_account && (
									<Button asChild variant="outline" size="sm" className="h-11 rounded-full sm:h-9">
										<Link
											href={accountHref(transaction.transfer_account.id)}
											onClick={() => onOpenChange(false)}
										>
											Open {transaction.transfer_account.label}
											<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
										</Link>
									</Button>
								)}
							</div>
						)}
					</div>
				)}

				<DialogFooter className="flex items-center justify-between sm:justify-between w-full">
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								type="button"
								variant="destructive"
								size="icon"
								disabled={isLoading || isDeleting}
								aria-label="Delete transaction"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
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
							<CancelShortcut />
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Changes
							<SubmitShortcut />
						</Button>
					</div>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
