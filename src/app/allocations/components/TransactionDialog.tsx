"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";

import { Loader2, Info, TrendingDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
	updateUnifiedTransaction,
	deleteUnifiedTransaction,
	createUnifiedTransaction,
} from "@/lib/actions/unified-transaction-actions";
import type { Transaction, AllocationCategory } from "../types";
import type { AccountWithType } from "@/app/balancesheet/types";
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { getTodayDateString } from "@/lib/date-utils";
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

interface TransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction?: Transaction | null;
	categories: AllocationCategory[];
	accounts?: AccountWithType[];
	defaultDate?: string;
}

export function TransactionDialog({
	open,
	onOpenChange,
	transaction,
	categories = [],
	accounts = [],
	defaultDate,
}: TransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate || getTodayDateString());
	const [categoryId, setCategoryId] = useState<string>("uncategorized");
	const [accountId, setAccountId] = useState<string>("none");
	const [type, setType] = useState<"income" | "expense">("expense");
	const [notes, setNotes] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		if (open) {
			if (transaction) {
				setName(transaction.name);
				setAmount(Math.abs(transaction.amount).toString());
				setDate(transaction.transaction_date.split("T")[0]);
				setCategoryId(transaction.category_id || "uncategorized");
				// Prefer direct account_id if available (from actions), else try linked transaction logic if data structure allows
				setAccountId(transaction.account_id || transaction.linked_account_transaction?.account_id || "none");
				setType(transaction.amount >= 0 ? "income" : "expense");
				setNotes(transaction.notes || "");
			} else {
				setName("");
				setAmount("");
				setDate(defaultDate || getTodayDateString());
				setCategoryId("uncategorized");
				setAccountId("none");
				setType("expense");
				setNotes("");
			}
		}
	}, [open, transaction, defaultDate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name || !amount || !date) {
			toast.error("Please fill in all required fields");
			return;
		}

		setIsLoading(true);

		try {
			const numAmount = parseFloat(amount);
			const finalCategoryId = categoryId === "uncategorized" ? null : categoryId;
			const finalAccountId = accountId === "none" ? null : accountId;

			if (transaction) {
				const success = await updateUnifiedTransaction(transaction.id, {
					description: name,
					amount: numAmount,
					date,
					categoryId: finalCategoryId,
					accountId: finalAccountId,
					type,
					notes,
				});

				if (success) {
					toast.success("Transaction updated");
					onOpenChange(false);
				} else {
					toast.error("Update Failed", {
						description: "Failed to update the transaction. Please check your connection.",
					});
				}
			} else {
				// Fallback or use unified for creation too if we want
				const result = await createUnifiedTransaction({
					description: name,
					amount: numAmount,
					date,
					categoryId: finalCategoryId,
					accountId: finalAccountId,
					type,
					notes,
				});

				if (result.success) {
					toast.success("Transaction created");
					onOpenChange(false);
				} else {
					toast.error("Creation Failed", {
						description: result.error || "Failed to create the transaction.",
					});
				}
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Error", {
				description: errorMessage,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!transaction) return;
		setIsDeleting(true);
		try {
			const success = await deleteUnifiedTransaction(transaction.id);
			if (success) {
				toast.success("Transaction deleted");
				onOpenChange(false);
			} else {
				toast.error("Delete Failed", { description: "Values couldn't be cleaned up properly." });
			}
		} catch (err) {
			toast.error("Error deleting transaction");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title={transaction ? "Edit Transaction" : "Add Transaction"}
			description={transaction ? "Modify transaction details below." : "Enter details for new transaction."}
			className="sm:max-w-[500px]"
			showCloseButton={false}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-6">
				<FormSection icon={<TrendingDown />} title="Transaction Type" variant="subtle">
					<CardSelector
						options={[
							{
								value: "expense",
								label: "Expense",
								icon: "📉",
								color: "bg-red-100",
							},
							{
								value: "income",
								label: "Income",
								icon: "📈",
								color: "bg-green-100",
							},
						]}
						value={type}
						onChange={setType}
						selectedBorderColor="border-blue-200"
					/>
				</FormSection>

				<FormSection icon={<Info />} title="Transaction Details" variant="subtle">
					<div className="space-y-2">
						<Label htmlFor="amount">Amount</Label>
						<ProminentAmountInput id="amount" value={amount} onChange={setAmount} hasError={false} />
					</div>
					<div className="flex flex-row gap-4">
						<div className="flex-1 space-y-2">
							<Label htmlFor="date">Date</Label>
							<DatePicker id="date" value={date} onChange={setDate} placeholder="Select transaction date" />
						</div>

						<div className="flex-1 space-y-2">
							<Label htmlFor="category">Category</Label>
							<Select value={categoryId} onValueChange={setCategoryId}>
								<SelectTrigger className="h-10">
									<SelectValue placeholder="Select a category" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="uncategorized">Uncategorized</SelectItem>
									{categories.map((cat) => (
										<SelectItem key={cat.id} value={cat.id}>
											{cat.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="account">
							Account <span className="text-muted-foreground font-normal">(Optional)</span>
						</Label>
						<Select value={accountId} onValueChange={setAccountId}>
							<SelectTrigger>
								<SelectValue placeholder="Select an account" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No Account</SelectItem>
								{accounts.map((acc) => (
									<SelectItem key={acc.id} value={acc.id}>
										{acc.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">Description</Label>
						<Input
							id="name"
							placeholder="e.g. Grocery Store"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							className="h-10"
						/>
					</div>
				</FormSection>

				{notes && (
					<FormSection variant="subtle">
						<div className="space-y-2">
							<Label htmlFor="notes">Notes (Optional)</Label>
							<Textarea
								id="notes"
								placeholder="Add any additional details..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								rows={3}
								className="bg-secondary border-border/60 resize-none"
							/>
						</div>
					</FormSection>
				)}

				<DialogFooter className="flex items-center justify-between sm:justify-between w-full">
					{transaction ? (
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
										This will permanently delete this transaction from your budget history.
										{accountId !== "none" && " It will also be removed from the linked account balance."}
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
					) : (
						<div />
					)}

					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{transaction ? "Save Changes" : "Create Transaction"}
						</Button>
					</div>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
