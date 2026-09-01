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

import { Loader2, Info, TrendingDown, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import {
	updateUnifiedTransaction,
	deleteUnifiedTransaction,
	createUnifiedTransaction,
} from "@/lib/actions/unified-transaction-actions";
import { VIRTUAL_UNCATEGORIZED_ID } from "../types";
import type { Transaction, AllocationCategory } from "../types";
import type { AccountWithType } from "@/app/balancesheet/types";
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { getTodayDateString } from "@/lib/date-utils";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
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
	boundaryMonth?: { year: number; month: number };
}

export function TransactionDialog({
	open,
	onOpenChange,
	transaction,
	categories = [],
	accounts = [],
	defaultDate,
	boundaryMonth,
}: TransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate || getTodayDateString());
	const [categoryId, setCategoryId] = useState<string>(VIRTUAL_UNCATEGORIZED_ID);
	const [accountId, setAccountId] = useState<string>("none");
	const [fromAccountId, setFromAccountId] = useState<string>("none");
	const [toAccountId, setToAccountId] = useState<string>("none");
	const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
	const [notes, setNotes] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		if (open) {
			if (transaction) {
				setName(transaction.name);
				setAmount(Math.abs(transaction.amount).toString());
				setDate(transaction.transaction_date.split("T")[0]);
				setCategoryId(transaction.category_id || VIRTUAL_UNCATEGORIZED_ID);
				const initialAcct = transaction.account_id || transaction.linked_account_transaction?.account_id || "none";
				setAccountId(initialAcct);
				setFromAccountId(initialAcct);
				setToAccountId("none");
				const isTransfer = transaction.source === "transfer";
				setType(isTransfer ? "transfer" : transaction.amount >= 0 ? "income" : "expense");
				setNotes(transaction.notes || "");
			} else {
				setName("");
				setAmount("");
				setDate(defaultDate || getTodayDateString());
				setCategoryId(VIRTUAL_UNCATEGORIZED_ID);
				setAccountId("none");
				setFromAccountId("none");
				setToAccountId("none");
				setType("expense");
				setNotes("");
			}
		}
	}, [open, transaction, defaultDate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!amount || !date || (type !== "transfer" && !name)) {
			toast.error("Please fill in all required fields");
			return;
		}

		if (type === "transfer") {
			if (fromAccountId === "none" || toAccountId === "none") {
				toast.error("Please select both source and destination accounts");
				return;
			}
			if (fromAccountId === toAccountId) {
				toast.error("Source and destination accounts must be different");
				return;
			}
		}

		setIsLoading(true);

		try {
			const numAmount = parseFloat(amount);
			const finalCategoryId = type === "transfer" ? null : categoryId === VIRTUAL_UNCATEGORIZED_ID ? null : categoryId;
			const finalAccountId = type === "transfer" ? (fromAccountId === "none" ? null : fromAccountId) : accountId === "none" ? null : accountId;
			const finalDescription = name.trim() || (type === "transfer" ? "Transfer" : "");

			if (transaction) {
				const success = await updateUnifiedTransaction(transaction.id, {
					description: finalDescription,
					amount: numAmount,
					date,
					categoryId: finalCategoryId,
					accountId: finalAccountId,
					fromAccountId: type === "transfer" ? (fromAccountId === "none" ? null : fromAccountId) : null,
					toAccountId: type === "transfer" ? (toAccountId === "none" ? null : toAccountId) : null,
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
				const result = await createUnifiedTransaction({
					description: finalDescription,
					amount: numAmount,
					date,
					categoryId: finalCategoryId,
					accountId: finalAccountId,
					fromAccountId: type === "transfer" ? (fromAccountId === "none" ? null : fromAccountId) : null,
					toAccountId: type === "transfer" ? (toAccountId === "none" ? null : toAccountId) : null,
					type,
					notes,
				});

				if (result.success) {
					toast.success(type === "transfer" ? "Transfer created" : "Transaction created");
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
			className="sm:max-w-[600px]"
			showCloseButton={false}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-6">
				{transaction?.is_recurring_stopped && (
					<div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
						<Ban className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
						<div>
							<span className="font-semibold">Recurring Stopped — Final Record</span>
							<p className="text-amber-700/90 dark:text-amber-400/90 mt-0.5">
								The recurring bill/subscription for this transaction was paused or deleted. Future transactions will not be generated automatically.
							</p>
						</div>
					</div>
				)}

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
							{
								value: "transfer",
								label: "Transfer",
								icon: "🔄",
								color: "bg-blue-100",
							},
						]}
						value={type}
						onChange={(val) => setType(val as any)}
						selectedBorderColor="border-blue-200"
					/>
				</FormSection>

				<FormSection icon={<Info />} title="Transaction Details" variant="subtle">
					<div className="space-y-2">
						<Label htmlFor="amount">Amount</Label>
						<ProminentAmountInput id="amount" value={amount} onChange={setAmount} hasError={false} />
					</div>

					{type === "transfer" ? (
						<>
							<div className="flex flex-row gap-4">
								<div className="flex-1 space-y-2">
									<Label htmlFor="date">Date</Label>
									<DatePicker
										id="date"
										value={date}
										onChange={setDate}
										placeholder="Select transaction date"
										minDate={
											boundaryMonth ? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-01` : undefined
										}
										maxDate={
											boundaryMonth
												? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-${new Date(boundaryMonth.year, boundaryMonth.month, 0).getDate()}`
												: undefined
										}
									/>
								</div>
								<div className="flex-1 space-y-2">
									<Label htmlFor="name">Description <span className="text-muted-foreground font-normal">(Optional)</span></Label>
									<Input
										id="name"
										placeholder="e.g. Account Transfer"
										value={name}
										onChange={(e) => setName(e.target.value)}
										className="h-10"
									/>
								</div>
							</div>

							<div className="p-3 bg-muted/60 rounded-lg text-xs text-muted-foreground flex items-start gap-2 border">
								<Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
								<span>Transfers move money directly between accounts and do not require a budget category.</span>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="fromAccount">From Account (Source)</Label>
									<Select value={fromAccountId} onValueChange={setFromAccountId}>
										<SelectTrigger>
											<SelectValue placeholder="Select source account" />
										</SelectTrigger>
										<SelectContent>
											{sortAccounts(accounts).map((acc) => (
												<SelectItem key={acc.id} value={acc.id}>
													{formatAccountDisplayName(acc)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="toAccount">To Account (Destination)</Label>
									<Select value={toAccountId} onValueChange={setToAccountId}>
										<SelectTrigger>
											<SelectValue placeholder="Select destination account" />
										</SelectTrigger>
										<SelectContent>
											{sortAccounts(accounts)
												.filter((acc) => acc.id !== fromAccountId)
												.map((acc) => (
													<SelectItem key={acc.id} value={acc.id}>
														{formatAccountDisplayName(acc)}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</>
					) : (
						<>
							<div className="flex flex-row gap-4">
								<div className="flex-1 space-y-2">
									<Label htmlFor="date">Date</Label>
									<DatePicker
										id="date"
										value={date}
										onChange={setDate}
										placeholder="Select transaction date"
										minDate={
											boundaryMonth ? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-01` : undefined
										}
										maxDate={
											boundaryMonth
												? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-${new Date(boundaryMonth.year, boundaryMonth.month, 0).getDate()}`
												: undefined
										}
									/>
								</div>

								<div className="flex-1 space-y-2">
									<Label htmlFor="category">Category</Label>
									<Select value={categoryId} onValueChange={setCategoryId}>
										<SelectTrigger className="h-10">
											<SelectValue placeholder="Select a category" />
										</SelectTrigger>
										<SelectContent>
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
										{sortAccounts(accounts).map((acc) => (
											<SelectItem key={acc.id} value={acc.id}>
												{formatAccountDisplayName(acc)}
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
						</>
					)}
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
