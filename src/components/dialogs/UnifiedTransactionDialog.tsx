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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, Info, Settings2, PlusCircle, Trash2 } from "lucide-react";
import {
	createUnifiedTransaction,
	getSuggestedAccountForCategory,
	getTransactionDescriptions,
} from "@/lib/actions/unified-transaction-actions";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import {
	getTransactionPresets,
	TransactionPreset,
	createTransactionsFromPresetBulk,
} from "@/app/allocations/preset-actions";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { FormSection } from "@/components/FormSection";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { TransactionTypeSwitch } from "@/components/dialogs/transaction-type-switch";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { cn } from "@/lib/utils";
import { getTodayDateString, parseLocalDate, formatDateString } from "@/lib/date-utils";
import { handleEnterSubmit } from "@/lib/enter-submit";
import { VIRTUAL_UNCATEGORIZED_ID } from "@/app/allocations/types";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
import { compareAlphabetically, sortAlphabetically } from "@/lib/sort-utils";
import { ManagePresetsDialog } from "./ManagePresetsDialog";
import { isDemoModeActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";
import { calculateAccountStanding, checkTransactionCaps } from "@/lib/account-validation-utils";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import { getContributionNotices } from "@/lib/contribution-plans";
import { ContributionNotices } from "@/components/common/ContributionDetails";
import type { ContributionSummary } from "@/lib/types/contribution";

interface UnifiedTransactionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	defaultDate?: string;
	defaultCategoryId?: string;
	defaultAccountId?: string;
	/** Pre-filled amount, used by the Pay Remaining flow. */
	defaultAmount?: number;
	/** Pre-selected transfer source/destination, used by the Pay Remaining flow. */
	defaultFromAccountId?: string;
	defaultToAccountId?: string;
	defaultType?: "income" | "expense" | "transfer";
	onSuccess?: () => void;
	context?: "balancesheet" | "allocations";
	boundaryMonth?: { year: number; month: number };
}

interface ValidationErrors {
	description?: string;
	amount?: string;
	date?: string;
	accountId?: string;
	fromAccountId?: string;
	toAccountId?: string;
}

/** "Enter details / From a preset" as plain underline tabs, so they read apart from the type switch. */
const MODE_TAB_CLASS =
	"type-control -mb-px h-10 rounded-none border-b-2 border-transparent px-0 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

export function UnifiedTransactionDialog({
	open,
	onOpenChange,
	categories = [],
	accounts = [],
	defaultDate,
	defaultCategoryId,
	defaultAccountId,
	defaultAmount,
	defaultFromAccountId,
	defaultToAccountId,
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
	const [isLoading, setIsLoading] = useState(false);

	// Manual Entry State
	const [type, setType] = useState<"income" | "expense" | "transfer">(defaultType || "expense");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate || getTodayDateString());
	const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || VIRTUAL_UNCATEGORIZED_ID);
	const [accountId, setAccountId] = useState<string>(defaultAccountId || "none");
	const [fromAccountId, setFromAccountId] = useState<string>("none");
	const [toAccountId, setToAccountId] = useState<string>("none");
	const [transactionType, setTransactionType] = useState<string>("deposit");
	const [incomeSource, setIncomeSource] = useState<string>("salary");
	const [notes, setNotes] = useState("");
	const [suggestedAccountInfo, setSuggestedAccountInfo] = useState<string | null>(null);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [activeTab, setActiveTab] = useState("manual");
	const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);

	// Presets State
	const [presets, setPresets] = useState<TransactionPreset[]>([]);
	const [selectedPresetId, setSelectedPresetId] = useState<string>("");
	const [selectedDatesMap, setSelectedDatesMap] = useState<Record<string, number>>({});
	const [isManagePresetsOpen, setIsManagePresetsOpen] = useState(false);
	const [isAddingFromPreset, setIsAddingFromPreset] = useState(false);

	const loadPresets = async () => {
		const res = await getTransactionPresets();
		if (res.success && res.data) {
			setPresets(res.data);
		}
	};

	useEffect(() => {
		if (open) {
			setType(defaultType || "expense");
			setDescription("");
			setAmount("");

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

			setCategoryId(defaultCategoryId || VIRTUAL_UNCATEGORIZED_ID);
			setAccountId(defaultAccountId || "none");
			setFromAccountId(defaultFromAccountId || "none");
			setToAccountId(defaultToAccountId || "none");
			if (defaultAmount && defaultAmount > 0) {
				setAmount(defaultAmount.toFixed(2));
			}
			setTransactionType(defaultType === "income" ? "deposit" : "withdrawal");
			setNotes("");
			setSuggestedAccountInfo(null);
			setErrors({});
			setActiveTab("manual");
			setSelectedDatesMap({});
			loadPresets();
			getTransactionDescriptions().then(setDescriptionSuggestions);
		}
	}, [
		open,
		defaultDate,
		defaultCategoryId,
		defaultAccountId,
		defaultAmount,
		defaultFromAccountId,
		defaultToAccountId,
		defaultType,
		boundaryMonth,
	]);

	useEffect(() => {
		setSelectedDatesMap({});
	}, [selectedPresetId]);

	useEffect(() => {
		if (type === "income" && !["deposit", "contribution", "refund"].includes(transactionType)) {
			setTransactionType("deposit");
		} else if (type === "expense" && !["withdrawal", "payment", "interest"].includes(transactionType)) {
			setTransactionType("withdrawal");
		}
	}, [type]);

	useEffect(() => {
		if (type === "transfer" || !categoryId || categoryId === VIRTUAL_UNCATEGORIZED_ID) {
			setSuggestedAccountInfo(null);
			return;
		}
		const loadSuggestedAccount = async () => {
			const suggestion = await getSuggestedAccountForCategory(categoryId);
			if (suggestion && suggestion.accountId) {
				setAccountId(suggestion.accountId);
				if (suggestion.reason === "linked_savings_goal") {
					setSuggestedAccountInfo("Picked the savings account for this category");
				} else if (suggestion.reason === "linked_debt_payment") {
					setSuggestedAccountInfo("Picked the payment account for this category");
				}
			} else {
				setSuggestedAccountInfo(null);
			}
		};
		loadSuggestedAccount();
	}, [categoryId, type]);

	const [allowOverpayment, setAllowOverpayment] = useState(false);

	const selectedTargetAccount =
		type === "transfer" ? accounts.find((a) => a.id === fromAccountId) : accounts.find((a) => a.id === accountId);

	const selectedAccountStanding = selectedTargetAccount ? calculateAccountStanding(selectedTargetAccount) : null;

	const fromAccount = type === "transfer" ? accounts.find((a) => a.id === fromAccountId) : null;
	const toAccount = type === "transfer" ? accounts.find((a) => a.id === toAccountId) : null;

	// Validate every account the transaction touches. `allowOverpayment` is intentionally
	// NOT applied here so the warning stays visible while the opt-in is ticked; the submit
	// handler decides whether the override clears the (overridable) violation.
	const capCheck =
		amount && parseFloat(amount) > 0
			? checkTransactionCaps({
					intent: type,
					amount: parseFloat(amount),
					account: type === "transfer" ? null : accounts.find((a) => a.id === accountId),
					fromAccount,
					toAccount,
					transactionType,
				})
			: { isValid: true, violations: [] as ReturnType<typeof checkTransactionCaps>["violations"] };

	// Contribution room warnings (issue #121): money going into an account that tracks room.
	// A direct transfer between two accounts of the same registered plan does not use room
	// (and so does not warn), since both accounts share one plan room.
	const contributionTarget = (() => {
		if (type === "transfer") {
			if (!toAccount?.track_contribution_room) return null;
			const samePlan =
				!!toAccount.contribution_plan &&
				toAccount.contribution_plan !== "other" &&
				fromAccount?.contribution_plan === toAccount.contribution_plan;
			return samePlan ? null : toAccount;
		}
		if (type === "income" && ["deposit", "contribution"].includes(transactionType)) {
			const target = accounts.find((a) => a.id === accountId);
			return target?.track_contribution_room ? target : null;
		}
		return null;
	})();
	const contributionTargetId = contributionTarget?.id ?? null;
	const [contributionSummary, setContributionSummary] = useState<ContributionSummary | null>(null);
	const contributionDate = parseLocalDate(date);
	const contributionYear = contributionDate.getFullYear();
	const contributionMonth = contributionDate.getMonth() + 1;

	useEffect(() => {
		if (!open || !contributionTargetId) {
			setContributionSummary(null);
			return;
		}
		let cancelled = false;
		getAccountContributionSummary(contributionTargetId, contributionYear, contributionMonth)
			.then((contribution) => {
				// Warn against the whole plan pool: every TFSA (etc.) shares one room.
				if (!cancelled) setContributionSummary(contribution?.pool ?? null);
			})
			.catch(() => {
				if (!cancelled) setContributionSummary(null);
			});
		return () => {
			cancelled = true;
		};
	}, [open, contributionTargetId, contributionYear, contributionMonth]);

	const contributionNotices =
		contributionTargetId && contributionSummary?.account_ids.includes(contributionTargetId) && parseFloat(amount) > 0
			? getContributionNotices(
					contributionSummary,
					(value) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value),
					parseFloat(amount)
				)
			: [];

	const firstViolation = capCheck.violations[0];
	const validationResult = {
		isValid: capCheck.isValid,
		warning: firstViolation?.message,
		maxAllowed: firstViolation?.maxAllowed,
		overridable: firstViolation?.overridable ?? false,
	};

	const validateForm = (): boolean => {
		const newErrors: ValidationErrors = {};
		let isValid = true;
		if (!description.trim() && type !== "transfer") {
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

		if (type === "transfer") {
			if (!fromAccountId || fromAccountId === "none") {
				newErrors.fromAccountId = "Source account is required";
				isValid = false;
			}
			if (!toAccountId || toAccountId === "none") {
				newErrors.toAccountId = "Destination account is required";
				isValid = false;
			}
			if (fromAccountId && toAccountId && fromAccountId !== "none" && fromAccountId === toAccountId) {
				newErrors.toAccountId = "Source and destination accounts must be different";
				isValid = false;
			}
		} else if (accountRequired && (accountId === "none" || !accountId)) {
			newErrors.accountId = "Account is required";
			isValid = false;
		}

		if (!validationResult.isValid && !(allowOverpayment && validationResult.overridable)) {
			newErrors.amount = validationResult.warning || "Amount exceeds account limit";
			isValid = false;
		}

		setErrors(newErrors);
		if (!isValid)
			toast.error("Please fill in all required fields", { description: "Check the form for displayed errors." });
		return isValid;
	};

	const submitTransaction = async () => {
		if (!validateForm()) return;
		setIsLoading(true);
		try {
			const numAmount = parseFloat(amount);
			const finalDescription = description.trim() || (type === "transfer" ? "Transfer" : "");
			const input: UnifiedTransactionInput = {
				description: finalDescription,
				amount: numAmount,
				date,
				type,
				categoryId: type === "transfer" ? null : categoryId === VIRTUAL_UNCATEGORIZED_ID ? null : categoryId,
				accountId: type === "transfer" ? null : accountId === "none" ? null : accountId,
				fromAccountId: type === "transfer" ? (fromAccountId === "none" ? null : fromAccountId) : null,
				toAccountId: type === "transfer" ? (toAccountId === "none" ? null : toAccountId) : null,
				transactionType: transactionType as any,
				notes: notes || undefined,
				allowOverpayment,
				source: type === "transfer" ? "transfer" : isAllocationsContext && type === "income" ? incomeSource : "manual",
			};

			// Demo mode: record in-memory instead of persisting to the server.
			if (isDemoModeActive()) {
				const categoryName =
					type === "transfer" ? "Transfer" : categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
				const accountName = accounts.find((a) => a.id === accountId)?.name;
				useDemoStore.getState().addTransaction({
					id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					date,
					description: finalDescription,
					category: categoryName,
					amount: numAmount,
					type: type === "transfer" ? "expense" : type,
					account: accountName,
				});
				toast.success(type === "transfer" ? "Transfer created" : "Transaction added");
				onOpenChange(false);
				onSuccess?.();
				return;
			}

			const result = await createUnifiedTransaction(input);
			if (result.success) {
				toast.success(type === "transfer" ? "Transfer created" : "Transaction added");
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error("Transaction Failed", { description: result.error || "Failed to add transaction." });
			}
		} catch (err) {
			toast.error("Transaction Error", { description: err instanceof Error ? err.message : "Unexpected error" });
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await submitTransaction();
	};

	const incrementDateCount = (dateStr: string) => {
		setSelectedDatesMap((prev) => ({
			...prev,
			[dateStr]: (prev[dateStr] || 0) + 1,
		}));
	};

	const decrementDateCount = (dateStr: string) => {
		setSelectedDatesMap((prev) => {
			const count = prev[dateStr] || 0;
			if (count <= 1) {
				const newMap = { ...prev };
				delete newMap[dateStr];
				return newMap;
			}
			return {
				...prev,
				[dateStr]: count - 1,
			};
		});
	};

	const removeDateEntry = (dateStr: string) => {
		setSelectedDatesMap((prev) => {
			const newMap = { ...prev };
			delete newMap[dateStr];
			return newMap;
		});
	};

	const formatDisplayDate = (dateStr: string) => {
		const date = parseLocalDate(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	};

	const handleAddFromPreset = async () => {
		if (!selectedPresetId) {
			toast.error("Please select a preset first.");
			return;
		}

		const entries = Object.entries(selectedDatesMap)
			.filter(([_, count]) => count > 0)
			.map(([dateStr, count]) => ({ date: dateStr, count }));

		if (entries.length === 0) {
			toast.error("Please select at least one date.");
			return;
		}

		setIsAddingFromPreset(true);
		try {
			const result = await createTransactionsFromPresetBulk(selectedPresetId, entries);
			if (result.success) {
				const preset = presets.find((p) => p.id === selectedPresetId);
				const totalCount = entries.reduce((acc, curr) => acc + curr.count, 0);
				toast.success(`Successfully added ${totalCount} transactions from preset "${preset?.name}"`);
				setSelectedDatesMap({});
				onSuccess?.();
				onOpenChange(false);
			} else {
				toast.error("Transaction Failed", { description: result.error });
			}
		} catch (err) {
			toast.error("Transaction Error", { description: "Unexpected error" });
		} finally {
			setIsAddingFromPreset(false);
		}
	};

	const selectedCategory = categories.find((c) => c.id === categoryId);
	const showCategoryBadge = selectedCategory?.category_type && selectedCategory.category_type !== "regular";

	const selectedPreset = presets.find((p) => p.id === selectedPresetId);

	// Preset date selection is locked to a single month (the allocation month being
	// viewed, or the current month otherwise), so overflowing days are disabled.
	const presetMonth = boundaryMonth ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
	const presetMonthStart = new Date(presetMonth.year, presetMonth.month - 1, 1);
	const presetMonthEnd = new Date(presetMonth.year, presetMonth.month, 0);
	const presetMonthStartStr = formatDateString(presetMonthStart);
	const presetMonthEndStr = formatDateString(presetMonthEnd);

	// Counting/bucket sort by day-of-month (O(n + 31)), newest-first.
	const selectedDateEntries = (() => {
		const buckets: Array<Array<[string, number]>> = Array.from({ length: 31 }, () => []);
		for (const [dateStr, count] of Object.entries(selectedDatesMap)) {
			if (count <= 0) continue;
			const day = Number(dateStr.slice(-2));
			if (day >= 1 && day <= 31) buckets[day - 1].push([dateStr, count]);
		}
		const ordered: Array<[string, number]> = [];
		for (let day = 30; day >= 0; day -= 1) {
			if (buckets[day].length) ordered.push(...buckets[day]);
		}
		return ordered;
	})();

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className="sm:max-w-[560px] max-h-[calc(100dvh-2rem)] overflow-y-auto"
					showCloseButton={false}
					onKeyDown={(event) => {
						// Only the manual form submits; the preset tab has its own action.
						if (activeTab !== "manual") return;
						handleEnterSubmit(event, submitTransaction);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add transaction</DialogTitle>
						<DialogDescription>
							Updates your budget, and the account&apos;s balance when you pick one.
						</DialogDescription>
					</DialogHeader>

					<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
						<TabsList className="mb-6 flex h-auto w-full justify-start gap-6 rounded-none border-b border-border/70 bg-transparent p-0">
							<TabsTrigger value="manual" className={MODE_TAB_CLASS}>
								Enter details
							</TabsTrigger>
							<TabsTrigger value="presets" className={MODE_TAB_CLASS}>
								From a preset
							</TabsTrigger>
						</TabsList>

						<TabsContent value="manual" className="mt-0">
							<form onSubmit={handleSubmit} className="flex flex-col gap-6">
								<TransactionTypeSwitch value={type} onChange={setType} />

								{!isAllocationsContext && type !== "transfer" && (
									<div className="space-y-2">
										<Label htmlFor="transactionType">
											{type === "income" ? "Income type" : "Expense type"} for the account
										</Label>
										<Select value={transactionType} onValueChange={setTransactionType}>
											<SelectTrigger className="h-10">
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
											<SelectContent>
												{type === "income" ? (
													<>
														<SelectItem value="contribution">Contribution</SelectItem>
														<SelectItem value="deposit">Deposit</SelectItem>
														<SelectItem value="refund">Refund</SelectItem>
													</>
												) : (
													<>
														<SelectItem value="interest">Interest</SelectItem>
														<SelectItem value="payment">Payment</SelectItem>
														<SelectItem value="withdrawal">Withdrawal</SelectItem>
													</>
												)}
											</SelectContent>
										</Select>
									</div>
								)}

								{isAllocationsContext && type === "income" && (
									<div className="space-y-2">
										<Label htmlFor="incomeSource">Income source</Label>
										<Select value={incomeSource} onValueChange={setIncomeSource}>
											<SelectTrigger className="h-10">
												<SelectValue placeholder="Select source" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="external">External or one-time</SelectItem>
												<SelectItem value="salary">Salary (expected income)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}

								<div className="flex flex-col gap-5">
									<div className="space-y-2">
										<Label htmlFor="amount" className="type-label text-muted-foreground">
											Amount
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
										{contributionNotices.length > 0 && (
											<div
												className="mt-2 rounded-lg border border-border/60 bg-muted/60 p-2.5"
												data-testid="contribution-room-warning"
											>
												<ContributionNotices notices={contributionNotices} />
											</div>
										)}
										{selectedTargetAccount && selectedAccountStanding && (
											<div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-card-muted/50 px-3 py-2.5 type-body-xs">
												<div className="flex items-center justify-between font-medium">
													{selectedAccountStanding.accountClass === "liability" ? (
														<>
															<span className="text-muted-foreground">Debt left today</span>
															<span className="type-value text-error">
																${selectedAccountStanding.remainingDebt.toFixed(2)}
															</span>
														</>
													) : (
														<>
															<span className="text-muted-foreground">Available balance</span>
															<span className="type-value text-primary">
																${selectedAccountStanding.availableBalance.toFixed(2)}
															</span>
														</>
													)}
												</div>

												{!validationResult.isValid && (
													<div className="mt-1 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-muted p-2.5 text-warning">
														<div className="flex items-start gap-1.5">
															<Info className="mt-0.5 h-4 w-4 shrink-0" />
															<span className="text-xs">{validationResult.warning}</span>
														</div>
														<div className="flex items-center justify-between border-t border-warning/20 pt-1">
															{validationResult.maxAllowed !== undefined && (
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	data-dialog-ignore-enter=""
																	className="h-7 border-warning/40 text-xs font-medium text-warning hover:bg-warning/15"
																	onClick={() => {
																		setAmount(validationResult.maxAllowed!.toFixed(2));
																		if (errors.amount) setErrors({ ...errors, amount: undefined });
																	}}
																>
																	Use the most allowed (${validationResult.maxAllowed.toFixed(2)})
																</Button>
															)}
															{validationResult.overridable && (
																<label className="flex cursor-pointer items-center gap-1.5 type-caption">
																	<input
																		type="checkbox"
																		checked={allowOverpayment}
																		onChange={(e) => setAllowOverpayment(e.target.checked)}
																		className="rounded border-warning/60 accent-[hsl(var(--warning))]"
																	/>
																	Allow overpayment
																</label>
															)}
														</div>
													</div>
												)}
											</div>
										)}
										{errors.amount && <p className="text-sm text-error">{errors.amount}</p>}
									</div>

									<div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
										<div className="flex-1 space-y-2">
											<Label htmlFor="date">
												Date <span className="text-error">*</span>
											</Label>
											<DatePicker
												id="date"
												value={date}
												onChange={setDate}
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
												Description
												{type === "transfer" ? (
													<span className="text-muted-foreground font-normal"> (Optional)</span>
												) : (
													<span className="text-error"> *</span>
												)}
											</Label>
											<AutocompleteInput
												id="description"
												placeholder={type === "transfer" ? "e.g. Account Transfer" : "e.g. Grocery Store"}
												value={description}
												onChange={(val) => {
													setDescription(val);
													if (errors.description) setErrors({ ...errors, description: undefined });
												}}
												suggestions={descriptionSuggestions}
												required={type !== "transfer"}
												className={cn("h-10", errors.description && "border-error")}
											/>
											{errors.description && <p className="text-sm text-error">{errors.description}</p>}
										</div>
									</div>
								</div>

								{type === "transfer" ? (
									<>
										<p className="type-body-xs -mt-1 flex items-start gap-2 text-muted-foreground">
											<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
											Transfers move money between your accounts, so they don&apos;t need a budget category.
										</p>

										<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="fromAccount">
													From <span className="text-error">*</span>
												</Label>
												<Select
													value={fromAccountId}
													onValueChange={(val) => {
														setFromAccountId(val);
														if (errors.fromAccountId) setErrors({ ...errors, fromAccountId: undefined });
													}}
												>
													<SelectTrigger className={cn("h-10", errors.fromAccountId && "border-error")}>
														<SelectValue placeholder="Select source account" />
													</SelectTrigger>
													<SelectContent>
														{sortAccounts(accounts)
															.filter((acc) => acc.id !== toAccountId)
															.map((acc) => (
																<SelectItem key={acc.id} value={acc.id}>
																	{formatAccountDisplayName(acc)}
																</SelectItem>
															))}
													</SelectContent>
												</Select>
												{errors.fromAccountId && <p className="text-sm text-error">{errors.fromAccountId}</p>}
											</div>

											<div className="space-y-2">
												<Label htmlFor="toAccount">
													To <span className="text-error">*</span>
												</Label>
												<Select
													value={toAccountId}
													onValueChange={(val) => {
														setToAccountId(val);
														if (errors.toAccountId) setErrors({ ...errors, toAccountId: undefined });
													}}
												>
													<SelectTrigger className={cn("h-10", errors.toAccountId && "border-error")}>
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
												{errors.toAccountId && <p className="text-sm text-error">{errors.toAccountId}</p>}
											</div>
										</div>
									</>
								) : (
									<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="category">
												Budget category{categoryRequired && <span className="text-error"> *</span>}
												{showCategoryBadge && !categoryDisabled && (
													<span className="ml-2 text-xs text-primary">
														{selectedCategory?.category_type === "savings_goal" && "(Savings Goal)"}
														{selectedCategory?.category_type === "debt_payment" && "(Debt Payment)"}
													</span>
												)}
											</Label>
											<Select
												value={categoryDisabled ? VIRTUAL_UNCATEGORIZED_ID : categoryId}
												onValueChange={setCategoryId}
												disabled={categoryDisabled}
											>
												<SelectTrigger className="h-10">
													<SelectValue placeholder="Select a category" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value={VIRTUAL_UNCATEGORIZED_ID}>Uncategorized</SelectItem>
													{categories
														.filter((cat) => cat.id !== VIRTUAL_UNCATEGORIZED_ID)
														.sort((a, b) => compareAlphabetically(a.name, b.name))
														.map((cat) => (
															<SelectItem key={cat.id} value={cat.id}>
																{cat.name}
															</SelectItem>
														))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label htmlFor="account">
												Account
												{accountRequired ? (
													<span className="text-error"> *</span>
												) : (
													<span className="font-normal text-muted-foreground"> (optional)</span>
												)}
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
													{!accountRequired && <SelectItem value="none">No account</SelectItem>}
													{sortAccounts(accounts).map((acc) => (
														<SelectItem key={acc.id} value={acc.id}>
															{formatAccountDisplayName(acc)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{suggestedAccountInfo && <p className="text-xs text-primary">{suggestedAccountInfo}</p>}
											{errors.accountId && <p className="text-sm text-error">{errors.accountId}</p>}
										</div>

										{accountId === "none" && categoryId !== VIRTUAL_UNCATEGORIZED_ID && (
											<p className="type-body-xs flex items-start gap-2 text-muted-foreground sm:col-span-2">
												<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
												Budget only: your budget updates, but no account balance changes.
											</p>
										)}
									</div>
								)}

								{notes && (
									<FormSection variant="subtle">
										<div className="space-y-2">
											<Label htmlFor="notes">
												Notes <span className="font-normal text-muted-foreground">(optional)</span>
											</Label>
											<Textarea
												id="notes"
												placeholder="Add any additional details..."
												value={notes}
												onChange={(e) => setNotes(e.target.value)}
												rows={3}
												className="resize-none"
											/>
										</div>
									</FormSection>
								)}

								<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-3">
									<Button
										type="button"
										variant="outline"
										className="w-full sm:w-auto"
										onClick={() => onOpenChange(false)}
										disabled={isLoading}
									>
										Cancel
										<CancelShortcut />
									</Button>
									<Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
										{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add transaction
										<SubmitShortcut />
									</Button>
								</DialogFooter>
							</form>
						</TabsContent>

						<TabsContent value="presets" className="mt-0 flex flex-col gap-6">
							<div className="flex flex-col gap-2">
								<div className="flex justify-between items-center">
									<Label>Preset</Label>
									<Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsManagePresetsOpen(true)}>
										<Settings2 className="h-4 w-4 mr-1" /> Manage
									</Button>
								</div>

								{presets.length === 0 ? (
									<div className="rounded-2xl border border-dashed border-border p-6 text-center">
										<p className="type-body-sm mb-4 text-muted-foreground">
											Save transactions you repeat, like a transit fare, and add them in a few taps.
										</p>
										<Button onClick={() => setIsManagePresetsOpen(true)} size="sm">
											<PlusCircle className="mr-2 h-4 w-4" /> Create a preset
										</Button>
									</div>
								) : (
									<Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
										<SelectTrigger>
											<SelectValue placeholder="Choose a transaction preset" />
										</SelectTrigger>
										<SelectContent>
											{sortAlphabetically(presets, (p) => p.name).map((p) => (
												<SelectItem key={p.id} value={p.id}>
													{p.name} (${p.amount.toFixed(2)})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</div>

							{selectedPreset && (
								<div className="flex flex-col gap-4">
									<div className="rounded-xl bg-card-muted/50 p-3 type-body-sm">
										<p>
											<strong>{selectedPreset.description}</strong>
										</p>
										<p className="text-muted-foreground mt-1">
											{selectedPreset.type === "expense" ? "Expense" : "Income"} of ${selectedPreset.amount.toFixed(2)},
											recorded as {selectedPreset.transaction_type}
										</p>
										<p className="type-body-xs mt-2 text-muted-foreground">
											Pick the days on the calendar. Use + and − in the list to add more than one on a day.
										</p>
									</div>

									<div className="relative flex justify-center rounded-2xl border border-border/70 p-2">
										{isAddingFromPreset && (
											<div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
												<Loader2 className="h-6 w-6 animate-spin text-primary" />
											</div>
										)}
										<Calendar
											className="rounded-md"
											mode="multiple"
											selected={Object.keys(selectedDatesMap)
												.filter((dateStr) => selectedDatesMap[dateStr] > 0)
												.map((dateStr) => parseLocalDate(dateStr))}
											onSelect={(dates) => {
												if (!dates) {
													setSelectedDatesMap({});
													return;
												}
												const newMap: Record<string, number> = {};
												dates.forEach((d) => {
													const dateStr = formatDateString(d);
													if (dateStr < presetMonthStartStr || dateStr > presetMonthEndStr) return;
													newMap[dateStr] = selectedDatesMap[dateStr] || 1;
												});
												setSelectedDatesMap(newMap);
											}}
											defaultMonth={presetMonthStart}
											month={presetMonthStart}
											disableNavigation
											disabled={[{ before: presetMonthStart }, { after: presetMonthEnd }]}
										/>
									</div>

									{/* Selected Dates summary */}
									{Object.keys(selectedDatesMap).length > 0 && (
										<div className="flex max-h-[160px] flex-col gap-2 overflow-y-auto rounded-2xl border border-border/70 p-2">
											<p className="type-label px-1 text-muted-foreground">Selected days</p>
											{selectedDateEntries.map(([dateStr, count]) => {
												const subtotal = selectedPreset.amount * count;
												return (
													<div
														key={dateStr}
														className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-2 text-xs"
													>
														<div className="flex flex-col gap-0.5">
															<span className="font-medium">{formatDisplayDate(dateStr)}</span>
															<span className="text-muted-foreground">
																{count} x ${selectedPreset.amount.toFixed(2)} = ${subtotal.toFixed(2)}
															</span>
														</div>
														<div className="flex items-center gap-1">
															<Button
																type="button"
																variant="outline"
																size="icon"
																className="h-6 w-6 text-xs font-bold"
																onClick={() => decrementDateCount(dateStr)}
															>
																-
															</Button>
															<span className="w-5 text-center font-semibold text-xs">{count}</span>
															<Button
																type="button"
																variant="outline"
																size="icon"
																className="h-6 w-6 text-xs font-bold"
																onClick={() => incrementDateCount(dateStr)}
															>
																+
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-6 w-6 text-error/80 hover:text-error hover:bg-error/10 ml-1"
																onClick={() => removeDateEntry(dateStr)}
															>
																<Trash2 className="h-3.5 w-3.5" />
															</Button>
														</div>
													</div>
												);
											})}
										</div>
									)}

									<Button
										type="button"
										onClick={handleAddFromPreset}
										disabled={Object.keys(selectedDatesMap).length === 0 || isAddingFromPreset}
										className="w-full mt-2"
									>
										{isAddingFromPreset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
										Confirm & Add {Object.values(selectedDatesMap).reduce((a, b) => a + b, 0)} Items (
										{selectedPreset.type === "expense" ? "-" : "+"}$
										{(Object.values(selectedDatesMap).reduce((a, b) => a + b, 0) * selectedPreset.amount).toFixed(2)})
									</Button>
								</div>
							)}
							<DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:gap-3">
								<Button
									type="button"
									variant="outline"
									className="w-full sm:w-auto"
									onClick={() => onOpenChange(false)}
								>
									Close
								</Button>
							</DialogFooter>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			<ManagePresetsDialog
				open={isManagePresetsOpen}
				onOpenChange={setIsManagePresetsOpen}
				categories={categories}
				accounts={accounts}
				onPresetsChanged={loadPresets}
			/>
		</>
	);
}
