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
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Info } from "lucide-react";
import { createUnifiedTransaction, getSuggestedAccountForCategory } from "@/lib/actions/unified-transaction-actions";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { FormSection } from "@/components/FormSection";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { CardSelector } from "@/components/CardSelector";
import { cn } from "@/lib/utils";
import { getTodayDateString } from "@/lib/date-utils";

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
	boundaryMonth?: { year: number; month: number };
}

interface ValidationErrors {
	description?: string;
	amount?: string;
	date?: string;
	accountId?: string;
}

export function UnifiedTransactionDialog({
	open,
	onOpenChange,
	categories = [],
	accounts = [],
	defaultDate,
	defaultCategoryId,
	defaultAccountId,
	defaultType,
	onSuccess,
	context,
	boundaryMonth,
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
	const [date, setDate] = useState(defaultDate || getTodayDateString());
	const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || "uncategorized");
	const [accountId, setAccountId] = useState<string>(defaultAccountId || "none");
	const [transactionType, setTransactionType] = useState<string>("deposit");
	const [notes, setNotes] = useState("");
	const [suggestedAccountInfo, setSuggestedAccountInfo] = useState<string | null>(null);
	const [errors, setErrors] = useState<ValidationErrors>({});

	useEffect(() => {
		if (open) {
			setType(defaultType || "expense");
			setDescription("");
			setAmount("");

			// Default date: use defaultDate, or today, but clamp to boundaryMonth if provided
			let initialDate = defaultDate || getTodayDateString();
			if (boundaryMonth) {
				const monthStart = `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-01`;
				const lastDay = new Date(boundaryMonth.year, boundaryMonth.month, 0).getDate();
				const monthEnd = `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-${lastDay}`;
				if (initialDate < monthStart || initialDate > monthEnd) {
					initialDate = monthStart;
				}
			}
			setDate(initialDate);

			setCategoryId(defaultCategoryId || "uncategorized");
			setAccountId(defaultAccountId || "none");
			setTransactionType(defaultType === "income" ? "deposit" : "expense");
			setNotes("");
			setSuggestedAccountInfo(null);
			setErrors({});
		}
	}, [open, defaultDate, defaultCategoryId, defaultAccountId, defaultType, boundaryMonth]);

	// Reset transactionType when switching between income and expense
	useEffect(() => {
		if (type === "income" && transactionType === "expense") {
			setTransactionType("deposit");
		} else if (type === "expense") {
			setTransactionType("expense");
		}
	}, [type]);

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

	const validateForm = (): boolean => {
		const newErrors: ValidationErrors = {};
		let isValid = true;

		if (!description.trim()) {
			newErrors.description = "Description is required";
			isValid = false;
		}

		if (!amount || parseFloat(amount) <= 0) {
			newErrors.amount = "Valid amount is required";
			isValid = false;
		}

		if (!date) {
			newErrors.date = "Date is required";
			isValid = false;
		}

		if (accountRequired && (accountId === "none" || !accountId)) {
			newErrors.accountId = "Account is required";
			isValid = false;
		}

		setErrors(newErrors);

		if (!isValid) {
			toast.error("Please fill in all required fields", {
				description: "Check the form for displayed errors.",
			});
		}

		return isValid;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
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
				transactionType: type === "income" ? (transactionType as any) : undefined,
				notes: notes || undefined,
			};

			const result = await createUnifiedTransaction(input);

			if (result.success) {
				toast.success("Transaction added");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error("Transaction Failed", {
					description: result.error || "Failed to add transaction. Please check your data and try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
			toast.error("Transaction Error", {
				description: errorMessage,
			});
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

					{type === "income" && (
						<div className="space-y-2">
							<Label htmlFor="transactionType">Income Type</Label>
							<Select value={transactionType} onValueChange={setTransactionType}>
								<SelectTrigger className="h-10">
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="deposit">💰 Deposit</SelectItem>
									<SelectItem value="contribution">➕ Contribution</SelectItem>
									<SelectItem value="refund">🔄 Refund</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					<FormSection icon={<Info />} title="Transaction Details" variant="subtle">
						<div className="space-y-2">
							<Label htmlFor="amount">
								Amount <span className="text-error">*</span>
							</Label>
							<ProminentAmountInput
								value={amount}
								onChange={(val) => {
									setAmount(val);
									if (errors.amount) setErrors({ ...errors, amount: undefined });
								}}
								id="amount"
								hasError={!!errors.amount}
							/>
							{errors.amount && <p className="text-sm text-error">{errors.amount}</p>}
						</div>

						<div className="flex flex-row justify-between gap-4">
							<div className="flex-1 space-y-2">
								<Label htmlFor="date">
									Date <span className="text-error">*</span>
								</Label>
								<DatePicker
									id="date"
									value={date}
									onChange={setDate}
									placeholder="Select transaction date"
									minDate={
										boundaryMonth
											? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-01`
											: undefined
									}
									maxDate={
										boundaryMonth
											? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-${new Date(boundaryMonth.year, boundaryMonth.month, 0).getDate()}`
											: undefined
									}
								/>
								{errors.date && <p className="text-sm text-error">{errors.date}</p>}
							</div>

							<div className="flex-1 space-y-2">
								<Label htmlFor="description">
									Description <span className="text-error">*</span>
								</Label>
								<Input
									id="description"
									placeholder="e.g. Grocery Store"
									value={description}
									onChange={(e) => {
										setDescription(e.target.value);
										if (errors.description) setErrors({ ...errors, description: undefined });
									}}
									required
									className={cn("h-10", errors.description && "border-error")}
								/>
								{errors.description && <p className="text-sm text-error">{errors.description}</p>}
							</div>
						</div>
					</FormSection>

					<div className="space-y-2">
						<Label htmlFor="category">
							Budget Category{categoryRequired && <span className="text-error">*</span>}
							{categoryRequired && !categoryDisabled && " "}
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
							<SelectTrigger className="h-10">
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
						<Label htmlFor="account">
							Account
							{accountRequired ? <span className="text-error">*</span> : " (Optional)"}
						</Label>
						<Select
							value={accountId}
							onValueChange={(val) => {
								setAccountId(val);
								if (errors.accountId) setErrors({ ...errors, accountId: undefined });
							}}
						>
							<SelectTrigger className={cn("h-10", errors.accountId && "border-error")}>
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
						{errors.accountId && <p className="text-sm text-error">{errors.accountId}</p>}
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
