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

import { Loader2, Info, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { createTransaction, updateTransaction } from "../actions";
import type { Transaction, AllocationCategory } from "../types";
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";

interface TransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction?: Transaction | null;
	categories: AllocationCategory[];
	defaultDate?: string;
}

export function TransactionDialog({
	open,
	onOpenChange,
	transaction,
	categories = [],
	defaultDate = new Date().toISOString().split("T")[0],
}: TransactionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate);
	const [categoryId, setCategoryId] = useState<string>("uncategorized");
	const [type, setType] = useState<"income" | "expense">("expense");
	const [notes, setNotes] = useState("");

	useEffect(() => {
		if (open) {
			if (transaction) {
				setName(transaction.name);
				setAmount(Math.abs(transaction.amount).toString());
				setDate(transaction.transaction_date.split("T")[0]);
				setCategoryId(transaction.category_id || "uncategorized");
				setType(transaction.amount >= 0 ? "income" : "expense");
				setNotes(transaction.notes || "");
			} else {
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
			description={transaction ? "Modify transaction details below." : "Enter details for new transaction."}
			className="sm:max-w-[425px]"
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

				<DialogFooter>
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
