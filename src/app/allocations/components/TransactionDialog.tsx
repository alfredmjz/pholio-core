"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTransaction, updateTransaction } from "../actions";
import type { Transaction, AllocationCategory } from "../types";
import { inferTransactionType } from "./TransactionTypeIcon";

interface TransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction?: Transaction | null; // If present, we are editing
	categories: AllocationCategory[];
	defaultDate?: string;
}

export function TransactionDialog({
	open,
	onOpenChange,
	transaction,
	categories,
	defaultDate = new Date().toISOString().split("T")[0],
}: TransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate);
	const [categoryId, setCategoryId] = useState<string>("uncategorized");
	const [type, setType] = useState<"income" | "expense">("expense");
	const [notes, setNotes] = useState("");

	// Reset form when dialog opens/closes or transaction changes
	useEffect(() => {
		if (open) {
			if (transaction) {
				// Editing
				setName(transaction.name);
				setAmount(Math.abs(transaction.amount).toString());
				setDate(transaction.transaction_date.split("T")[0]);
				setCategoryId(transaction.category_id || "uncategorized");
				setType(transaction.amount >= 0 ? "income" : "expense");
				setNotes(transaction.notes || "");
			} else {
				// Creating
				setName("");
				setAmount("");
				setDate(defaultDate);
				setCategoryId("uncategorized");
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
			const finalCategoryId = categoryId === "uncategorized" ? undefined : categoryId;

			if (transaction) {
				// Update
				const success = await updateTransaction(transaction.id, {
					name,
					amount: numAmount,
					transactionDate: date,
					categoryId: finalCategoryId,
					type,
					notes,
				});

				if (success) {
					toast.success("Transaction updated");
					onOpenChange(false);
				} else {
					toast.error("Failed to update transaction");
				}
			} else {
				// Create
				const newTx = await createTransaction(name, numAmount, date, finalCategoryId, type, notes);

				if (newTx) {
					toast.success("Transaction created");
					onOpenChange(false);
				} else {
					toast.error("Failed to create transaction");
				}
			}
		} catch (error) {
			console.error(error);
			toast.error("An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title={transaction ? "Edit Transaction" : "Add Transaction"}
			description={transaction ? "Modify transaction details below." : "Enter the details for the new transaction."}
			className="sm:max-w-[425px]"
		>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{/* Type Selection */}
					<div className="flex justify-center mb-2">
						<div className="bg-muted p-1 rounded-lg flex space-x-1">
							<Button
								type="button"
								variant={type === "expense" ? "default" : "ghost"}
								size="sm"
								onClick={() => setType("expense")}
								className="w-24"
							>
								Expense
							</Button>
							<Button
								type="button"
								variant={type === "income" ? "default" : "ghost"}
								size="sm"
								onClick={() => setType("income")}
								className="w-24"
							>
								Income
							</Button>
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="date">Date</Label>
						<Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
					</div>

					<div className="grid gap-2">
						<Label htmlFor="name">Description</Label>
						<Input
							id="name"
							placeholder="e.g. Grocery Store"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="amount">Amount</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
							<Input
								id="amount"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								className="pl-7"
								required
							/>
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="category">Category</Label>
						<Select value={categoryId} onValueChange={setCategoryId}>
							<SelectTrigger>
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

					<div className="grid gap-2">
						<Label htmlFor="notes">Notes (Optional)</Label>
						<Textarea
							id="notes"
							placeholder="Add any additional details..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
						/>
					</div>

					<DialogFooter className="pt-4">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{transaction ? "Save Changes" : "Create Transaction"}
						</Button>
					</DialogFooter>
				</form>
		</ControlBasedDialog>
	);
}
