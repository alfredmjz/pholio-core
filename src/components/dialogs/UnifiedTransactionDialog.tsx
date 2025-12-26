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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Info } from "lucide-react";
import { createUnifiedTransaction, getSuggestedAccountForCategory } from "@/lib/actions/unified-transaction-actions";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { FormSection } from "@/components/FormSection";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { CardSelector } from "@/components/CardSelector";

interface UnifiedTransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	defaultDate?: string;
	defaultCategoryId?: string;
	defaultAccountId?: string;
	defaultType?: "income" | "expense";
	onSuccess?: () => void;
	context?: "balancesheet" | "allocations";
}

export function UnifiedTransactionDialog({
	open,
	onOpenChange,
	categories = [],
	accounts = [],
	defaultDate = new Date().toISOString().split("T")[0],
	defaultCategoryId,
	defaultAccountId,
	defaultType,
	onSuccess,
	context,
}: UnifiedTransactionDialogProps) {
	const isBalanceSheetContext = context === "balancesheet";
	const isAllocationsContext = context === "allocations";
	const accountRequired = isBalanceSheetContext;
	const categoryDisabled = isBalanceSheetContext;
	const categoryRequired = isAllocationsContext;
	const accountOptional = isAllocationsContext || !context;
	const [isLoading, setIsLoading] = useState(false);
	const [type, setType] = useState<"income" | "expense">(defaultType || "expense");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate);
	const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || "uncategorized");
	const [accountId, setAccountId] = useState<string>(defaultAccountId || "none");
	const [notes, setNotes] = useState("");
	const [suggestedAccountInfo, setSuggestedAccountInfo] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setType(defaultType || "expense");
			setDescription("");
			setAmount("");
			setDate(defaultDate);
			setCategoryId(defaultCategoryId || "uncategorized");
			setAccountId(defaultAccountId || "none");
			setNotes("");
			setSuggestedAccountInfo(null);
		}
	}, [open, defaultDate, defaultCategoryId, defaultAccountId, defaultType]);

	useEffect(() => {
		if (!categoryId || categoryId === "uncategorized") {
			setSuggestedAccountInfo(null);
			return;
		}

		const loadSuggestedAccount = async () => {
			const suggestion = await getSuggestedAccountForCategory(categoryId);
			if (suggestion && suggestion.accountId) {
				setAccountId(suggestion.accountId);
				if (suggestion.reason === "linked_savings_goal") {
					setSuggestedAccountInfo("💰 Auto-selected savings account");
				} else if (suggestion.reason === "linked_debt_payment") {
					setSuggestedAccountInfo("💳 Auto-selected payment account");
				}
			} else {
				setSuggestedAccountInfo(null);
			}
		};

		loadSuggestedAccount();
	}, [categoryId]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!description || !amount || !date) {
			toast.error("Please fill in all required fields");
			return;
		}

		if (accountRequired && (accountId === "none" || !accountId)) {
			toast.error("Please select an account");
			return;
		}

		setIsLoading(true);

		try {
			const numAmount = parseFloat(amount);

			const input: UnifiedTransactionInput = {
				description,
				amount: numAmount,
				date,
				type,
				categoryId: categoryId === "uncategorized" ? null : categoryId,
				accountId: accountId === "none" ? null : accountId,
				notes: notes || undefined,
			};

			const result = await createUnifiedTransaction(input);

			if (result.success) {
				toast.success("Transaction added");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error(result.error || "Failed to add transaction");
			}
		} catch (error) {
			console.error(error);
			toast.error("An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const selectedCategory = categories.find((c) => c.id === categoryId);
	const showCategoryBadge = selectedCategory?.category_type && selectedCategory.category_type !== "regular";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Add Transaction</DialogTitle>
					<DialogDescription>Enter transaction details to update your budget and account balance.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					<FormSection
						icon={type === "expense" ? <TrendingDown /> : <TrendingUp />}
						title="Transaction Type"
						variant="subtle"
					>
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
						<div className="flex flex-row justify-between gap-4">
							<div className="flex-1 space-y-2">
								<Label htmlFor="date">Date *</Label>
								<Input
									id="date"
									type="date"
									value={date}
									onChange={(e) => setDate(e.target.value)}
									required
									className="h-10"
								/>
							</div>

							<div className="flex-1 space-y-2">
								<Label htmlFor="description">Description *</Label>
								<Input
									id="description"
									placeholder="e.g. Grocery Store"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									required
									className="h-10"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="date">Amount</Label>
							<ProminentAmountInput value={amount} onChange={setAmount} id="amount" />
						</div>
					</FormSection>

					<div className="space-y-2">
						<Label htmlFor="category">
							Budget Category{categoryRequired && " *"}
							{categoryDisabled && (
								<span className="ml-2 text-xs text-primary">(Not applicable for balance sheet)</span>
							)}
							{showCategoryBadge && !categoryDisabled && (
								<span className="ml-2 text-xs text-primary">
									{selectedCategory?.category_type === "savings_goal" && "(Savings Goal)"}
									{selectedCategory?.category_type === "debt_payment" && "(Debt Payment)"}
								</span>
							)}
						</Label>
						<Select
							value={categoryDisabled ? "uncategorized" : categoryId}
							onValueChange={setCategoryId}
							disabled={categoryDisabled}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="uncategorized">Uncategorized</SelectItem>
								{categories.map((cat) => (
									<SelectItem key={cat.id} value={cat.id}>
										{cat.category_type === "savings_goal" && "💰 "}
										{cat.category_type === "debt_payment" && "💳 "}
										{cat.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="account">Account{accountRequired ? " *" : " (Optional)"}</Label>
						<Select value={accountId} onValueChange={setAccountId}>
							<SelectTrigger>
								<SelectValue placeholder={accountRequired ? "Select an account" : "No account selected"} />
							</SelectTrigger>
							<SelectContent>
								{!accountRequired && <SelectItem value="none">No Account</SelectItem>}
								{accounts.map((acc) => (
									<SelectItem key={acc.id} value={acc.id}>
										{acc.name} {acc.institution && `- ${acc.institution}`}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{suggestedAccountInfo && <p className="text-xs text-primary">{suggestedAccountInfo}</p>}
					</div>

					{accountId === "none" && categoryId !== "uncategorized" && (
						<p className="text-sm text-primary flex items-start gap-2 p-3 bg-muted rounded-lg">
							<Info className="h-4 w-4 shrink-0 mt-0.5" />
							<span>Budget-only transaction: Your budget will update, but no account balance will change.</span>
						</p>
					)}

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
							Add Transaction
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
