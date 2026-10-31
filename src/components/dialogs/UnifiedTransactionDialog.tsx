"use client";

import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { takesCashAdvances } from "@/app/accounts/account-charge-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger, UNDERLINE_TAB_CLASS } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, Info, Settings2, PlusCircle, Trash2, Minus, Plus } from "lucide-react";
import { createUnifiedTransaction, getTransactionDescriptions } from "@/lib/actions/unified-transaction-actions";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import {
	getTransactionPresets,
	TransactionPreset,
	createTransactionsFromPresetBulk,
} from "@/app/allocations/preset-actions";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { FormSection } from "@/components/FormSection";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { TransactionTypeSwitch } from "@/components/dialogs/transaction-type-switch";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { cn } from "@/lib/utils";
import { getTodayDateString, parseLocalDate, formatDateString, formatFullDate } from "@/lib/date-utils";
import { handleEnterSubmit } from "@/lib/enter-submit";
import { VIRTUAL_UNCATEGORIZED_ID } from "@/app/allocations/types";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
import { formatMoney } from "@/lib/format";
import { getAccountTransactionTypeOptions, getDefaultAccountTransactionType } from "@/lib/account-transaction-types";
import { compareAlphabetically, sortAlphabetically } from "@/lib/sort-utils";
import { ManagePresetsDialog } from "./ManagePresetsDialog";
import { TransferRoute, TransferRouteSummary } from "./transfer-route";
import { CapWarning } from "./cap-warning";
import { isSampleDataActive } from "@/lib/demo-mode";
import { createDemoId, recordDemoUnifiedTransaction, useDemoStore } from "@/lib/demo-store";
import { calculateAccountStanding, checkTransactionCaps } from "@/lib/account-validation-utils";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import { formatContributionAmount, getContributionNotices } from "@/lib/contribution-plans";
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
	context?: "accounts" | "allocations";
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
	const isAccountsContext = context === "accounts";
	const isAllocationsContext = context === "allocations";
	const accountRequired = isAccountsContext;
	const categoryDisabled = isAccountsContext;
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
	// Transfers run in two steps: pick the accounts, then the amount and date.
	const [transferStep, setTransferStep] = useState<"route" | "details">("route");
	const [transactionType, setTransactionType] = useState<string>("deposit");
	const [incomeSource, setIncomeSource] = useState<string>("salary");
	const [notes, setNotes] = useState("");
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
			setTransferStep("route");
			if (defaultAmount && defaultAmount > 0) {
				setAmount(defaultAmount.toFixed(2));
			}
			setTransactionType(
				getDefaultAccountTransactionType(
					accounts.find((a) => a.id === defaultAccountId)?.account_type?.class === "liability",
					defaultType === "income" ? "income" : "expense"
				)
			);
			setNotes("");
			setIsCashAdvance(false);
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
		if (activeTab !== "presets") return;
		const current = presets.find((p) => p.id === selectedPresetId);
		if (current && current.type === type) return;
		const sameRoute =
			type === "transfer"
				? presets.find(
						(p) => p.type === "transfer" && p.account_id === fromAccountId && p.to_account_id === toAccountId
					)
				: undefined;
		setSelectedPresetId(sameRoute?.id ?? "");
	}, [activeTab, type, presets]);

	// The account type options depend on the selected account's class; reset an option that no
	// longer applies when the intent or the account changes.
	const accountIsLiability = accounts.find((a) => a.id === accountId)?.account_type?.class === "liability";
	const transactionTypeOptions = type === "transfer" ? [] : getAccountTransactionTypeOptions(accountIsLiability, type);

	useEffect(() => {
		if (type === "transfer") return;
		if (!transactionTypeOptions.some((option) => option.value === transactionType)) {
			setTransactionType(getDefaultAccountTransactionType(accountIsLiability, type));
		}
	}, [type, accountIsLiability, transactionType]);

	const [allowOverpayment, setAllowOverpayment] = useState(false);

	const selectedTargetAccount =
		type === "transfer" ? accounts.find((a) => a.id === fromAccountId) : accounts.find((a) => a.id === accountId);

	const selectedAccountStanding = selectedTargetAccount ? calculateAccountStanding(selectedTargetAccount) : null;

	const [isCashAdvance, setIsCashAdvance] = useState(false);
	const canCashAdvance = type === "expense" && !!selectedTargetAccount && takesCashAdvances(selectedTargetAccount);

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
			? getContributionNotices(contributionSummary, (value) => formatContributionAmount(value), parseFloat(amount))
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

		const overLimit = !validationResult.isValid && !(allowOverpayment && validationResult.overridable);
		if (overLimit) {
			newErrors.amount = validationResult.warning || "Amount exceeds account limit";
			isValid = false;
		}

		setErrors(newErrors);
		if (overLimit && Object.keys(newErrors).length === 1) {
			toast.error("The amount is too high", { description: newErrors.amount });
		} else if (!isValid) {
			toast.error("Please fill in all required fields", { description: "Check the form for displayed errors." });
		}
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
				isCashAdvance: canCashAdvance && isCashAdvance,
				source: type === "transfer" ? "transfer" : isAllocationsContext && type === "income" ? incomeSource : "manual",
			};

			// Demo mode: record in-memory instead of persisting to the server.
			if (isSampleDataActive()) {
				const categoryName =
					type === "transfer" ? "Transfer" : categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
				const accountName = accounts.find((a) => a.id === accountId)?.name;
				useDemoStore.getState().addTransaction({
					id: createDemoId("demo"),
					date,
					description: finalDescription,
					category: categoryName,
					amount: numAmount,
					type: type === "transfer" ? "expense" : type,
					account: accountName,
				});
				recordDemoUnifiedTransaction(input);
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

	const isTransferRoute = type === "transfer" && transferStep === "route";
	const isTransferDetails = type === "transfer" && transferStep === "details";

	const goToTransferDetails = () => {
		const routeErrors: ValidationErrors = {};
		if (fromAccountId === "none") routeErrors.fromAccountId = "Choose where the money comes from";
		if (toAccountId === "none") routeErrors.toAccountId = "Choose where the money goes";
		setErrors((prev) => ({ ...prev, fromAccountId: routeErrors.fromAccountId, toAccountId: routeErrors.toAccountId }));
		if (!routeErrors.fromAccountId && !routeErrors.toAccountId) {
			continuedAtRef.current = performance.now();
			setTransferStep("details");
		}
	};

	// When Continue was last pressed: a submit landing in the same moment is that press, not a
	// request to save (the step swap turns the button under the pointer into the submit button).
	const continuedAtRef = useRef(0);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isTransferRoute) {
			goToTransferDetails();
			return;
		}
		if (performance.now() - continuedAtRef.current < 500) return;
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
		return formatFullDate(dateStr);
	};

	const handleAddFromPreset = async () => {
		if (!selectedPresetId) {
			toast.error("Pick a preset first");
			return;
		}

		const entries = Object.entries(selectedDatesMap)
			.filter(([_, count]) => count > 0)
			.map(([dateStr, count]) => ({ date: dateStr, count }));

		if (entries.length === 0) {
			toast.error("Pick at least one day");
			return;
		}

		setIsAddingFromPreset(true);
		try {
			const result = await createTransactionsFromPresetBulk(selectedPresetId, entries);
			if (result.success) {
				const preset = presets.find((p) => p.id === selectedPresetId);
				const totalCount = entries.reduce((acc, curr) => acc + curr.count, 0);
				toast.success(
					`Added ${totalCount} ${preset?.type === "transfer" ? (totalCount === 1 ? "transfer" : "transfers") : totalCount === 1 ? "transaction" : "transactions"} from ${preset?.name ?? "the preset"}`
				);
				setSelectedDatesMap({});
				onSuccess?.();
				onOpenChange(false);
			} else {
				toast.error("Couldn't add the transactions", { description: result.error });
			}
		} catch (err) {
			toast.error("Something went wrong", { description: "Try again in a moment." });
		} finally {
			setIsAddingFromPreset(false);
		}
	};

	const presetsOfType = presets.filter((p) => p.type === type);
	const selectedPreset = presetsOfType.find((p) => p.id === selectedPresetId);
	const accountNameById = (id: string | null | undefined) =>
		accounts.find((a) => a.id === id)?.name ?? "a missing account";
	const presetCount = Object.values(selectedDatesMap).reduce((sum, count) => sum + count, 0);

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
						handleEnterSubmit(event, isTransferRoute ? goToTransferDetails : submitTransaction);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add transaction</DialogTitle>
						<DialogDescription>
							Updates your budget, and the account&apos;s balance when you pick one.
						</DialogDescription>
					</DialogHeader>

					{/* The type comes first and holds across both tabs, so moving to a preset keeps it. */}
					<TransactionTypeSwitch
						className="mt-2"
						value={type}
						onChange={(next) => {
							setType(next);
							if (next === "transfer") setTransferStep("route");
						}}
					/>

					<Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 w-full">
						<TabsList className="mb-6 flex h-auto w-full justify-start gap-6 rounded-none border-b border-border/70 bg-transparent p-0">
							<TabsTrigger value="manual" className={UNDERLINE_TAB_CLASS}>
								Enter details
							</TabsTrigger>
							<TabsTrigger value="presets" className={UNDERLINE_TAB_CLASS}>
								From a preset
							</TabsTrigger>
						</TabsList>

						<TabsContent value="manual" className="mt-0">
							<form onSubmit={handleSubmit} className="flex flex-col gap-6">
								{isTransferDetails && (
									<TransferRouteSummary
										from={fromAccount ?? undefined}
										to={toAccount ?? undefined}
										onChange={() => setTransferStep("route")}
									/>
								)}

								{isTransferRoute ? (
									<>
										<TransferRoute
											accounts={accounts}
											fromAccountId={fromAccountId}
											toAccountId={toAccountId}
											onFromChange={(id) => {
												setFromAccountId(id);
												setErrors((prev) => ({ ...prev, fromAccountId: undefined }));
											}}
											onToChange={(id) => {
												setToAccountId(id);
												setErrors((prev) => ({ ...prev, toAccountId: undefined }));
											}}
											onSwap={() => {
												setFromAccountId(toAccountId);
												setToAccountId(fromAccountId);
												setErrors((prev) => ({ ...prev, fromAccountId: undefined, toAccountId: undefined }));
											}}
											errors={errors}
										/>
										<p className="type-body-xs flex items-start gap-2 text-muted-foreground">
											<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
											Transfers move money between your accounts, so they don&apos;t need a budget category.
										</p>
									</>
								) : (
									<>
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
														{transactionTypeOptions.map((option) => (
															<SelectItem key={option.value} value={option.value}>
																{option.label}
															</SelectItem>
														))}
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
																		{formatMoney(selectedAccountStanding.remainingDebt, { showCents: true })}
																	</span>
																</>
															) : (
																<>
																	<span className="text-muted-foreground">Available balance</span>
																	<span className="type-value text-primary">
																		{formatMoney(selectedAccountStanding.availableBalance, { showCents: true })}
																	</span>
																</>
															)}
														</div>

														{!validationResult.isValid && validationResult.warning && (
															<div className="mt-1">
																<CapWarning
																	message={validationResult.warning}
																	maxAllowed={validationResult.maxAllowed}
																	onUseMax={(max) => {
																		setAmount(max.toFixed(2));
																		if (errors.amount) setErrors({ ...errors, amount: undefined });
																	}}
																	overridable={validationResult.overridable}
																	allowOverpayment={allowOverpayment}
																	onAllowOverpaymentChange={setAllowOverpayment}
																/>
															</div>
														)}
													</div>
												)}
												{errors.amount && <p className="text-sm text-error">{errors.amount}</p>}
												{canCashAdvance && (
													<div className="mt-3 flex items-center gap-2">
														<Switch id="cash-advance" checked={isCashAdvance} onCheckedChange={setIsCashAdvance} />
														<Label htmlFor="cash-advance" className="type-body-sm cursor-pointer text-muted-foreground">
															Cash advance (adds the card&apos;s cash advance fee)
														</Label>
													</div>
												)}
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

										{type === "transfer" ? null : (
											<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
												<div className="space-y-2">
													<Label htmlFor="category">
														Budget category{categoryRequired && <span className="text-error"> *</span>}
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
															<SelectValue
																placeholder={accountRequired ? "Select an account" : "No account selected"}
															/>
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
									</>
								)}

								<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-3">
									{isTransferDetails ? (
										<Button
											type="button"
											variant="outline"
											className="w-full sm:w-auto"
											onClick={() => setTransferStep("route")}
											disabled={isLoading}
										>
											Back
										</Button>
									) : (
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
									)}
									{isTransferRoute ? (
										// Distinct keys: reusing one <button> would let the Continue click land as a submit.
										<Button
											key="continue"
											type="button"
											className="w-full sm:w-auto"
											onClick={(event) => {
												// Stop the click from also submitting the form once step two renders.
												event.preventDefault();
												goToTransferDetails();
											}}
										>
											Continue
											<SubmitShortcut />
										</Button>
									) : (
										<Button key="submit" type="submit" className="w-full sm:w-auto" disabled={isLoading}>
											{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
											{type === "transfer" ? "Add transfer" : "Add transaction"}
											<SubmitShortcut />
										</Button>
									)}
								</DialogFooter>
							</form>
						</TabsContent>

						<TabsContent value="presets" className="mt-0 flex flex-col gap-6">
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<Label>Preset</Label>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-primary"
										onClick={() => setIsManagePresetsOpen(true)}
									>
										<Settings2 className="h-4 w-4" aria-hidden /> Manage
									</Button>
								</div>

								{presetsOfType.length === 0 ? (
									<div className="flex flex-col items-start gap-3 py-2">
										<p className="type-body-sm text-muted-foreground">
											{type === "transfer"
												? "No transfer presets yet. Save one you repeat, like a monthly move to savings."
												: type === "income"
													? "No income presets yet. Save income you record often, like a side gig payment."
													: "No expense presets yet. Save something you repeat, like a transit fare."}
										</p>
										<Button onClick={() => setIsManagePresetsOpen(true)} size="sm" className="rounded-full">
											<PlusCircle className="mr-2 h-4 w-4" aria-hidden /> Create a preset
										</Button>
									</div>
								) : (
									<Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
										<SelectTrigger>
											<SelectValue placeholder="Choose a transaction preset" />
										</SelectTrigger>
										<SelectContent>
											{sortAlphabetically(presetsOfType, (p) => p.name).map((p) => (
												<SelectItem key={p.id} value={p.id}>
													{p.name} (${p.amount.toFixed(2)})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}

								{selectedPreset && (
									<p className="type-body-sm text-muted-foreground">
										{selectedPreset.type === "transfer"
											? `A transfer of $${selectedPreset.amount.toFixed(2)} from ${accountNameById(selectedPreset.account_id)} to ${accountNameById(selectedPreset.to_account_id)}.`
											: `${selectedPreset.type === "expense" ? "An expense" : "Income"} of $${selectedPreset.amount.toFixed(2)}, recorded as ${selectedPreset.transaction_type}.`}
									</p>
								)}
							</div>

							{selectedPreset && (
								<div className="flex flex-col gap-2">
									<div className="flex items-baseline justify-between gap-3">
										<Label>Days</Label>
										<span className="type-body-xs text-muted-foreground">Pick each day it happened</span>
									</div>
									<div className="relative flex justify-center border-y border-border/70 py-2">
										{isAddingFromPreset && (
											<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
												<Loader2 className="h-6 w-6 animate-spin text-primary" />
											</div>
										)}
										<Calendar
											className="bg-transparent p-0 [--cell-size:2.5rem]"
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
											hideNavigation
											disableNavigation
											disabled={[{ before: presetMonthStart }, { after: presetMonthEnd }]}
										/>
									</div>

									{selectedDateEntries.length > 0 && (
										<ul
											className="flex max-h-[180px] flex-col divide-y divide-border/50 overflow-y-auto"
											aria-label="Picked days"
										>
											{selectedDateEntries.map(([dateStr, count]) => (
												<li key={dateStr} className="flex items-center justify-between gap-3 py-2">
													<span className="min-w-0">
														<span className="type-body-sm block font-medium text-primary">
															{formatDisplayDate(dateStr)}
														</span>
														<span className="type-body-xs block text-muted-foreground">
															{count} × ${selectedPreset.amount.toFixed(2)} = $
															{(selectedPreset.amount * count).toFixed(2)}
														</span>
													</span>
													<span className="flex shrink-0 items-center gap-1">
														<span className="flex items-center rounded-full border border-border">
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-7 w-7 rounded-full"
																onClick={() => decrementDateCount(dateStr)}
																aria-label={`One fewer on ${formatDisplayDate(dateStr)}`}
															>
																<Minus className="h-3.5 w-3.5" />
															</Button>
															<span className="type-body-sm w-5 text-center tabular-nums">{count}</span>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-7 w-7 rounded-full"
																onClick={() => incrementDateCount(dateStr)}
																aria-label={`One more on ${formatDisplayDate(dateStr)}`}
															>
																<Plus className="h-3.5 w-3.5" />
															</Button>
														</span>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-7 w-7 rounded-full text-muted-foreground hover:text-error"
															onClick={() => removeDateEntry(dateStr)}
															aria-label={`Remove ${formatDisplayDate(dateStr)}`}
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</span>
												</li>
											))}
										</ul>
									)}
								</div>
							)}

							<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-3">
								<Button
									type="button"
									variant="outline"
									className="w-full sm:w-auto"
									onClick={() => onOpenChange(false)}
									disabled={isAddingFromPreset}
								>
									Cancel
									<CancelShortcut />
								</Button>
								{selectedPreset && (
									<Button
										type="button"
										className="w-full sm:w-auto"
										onClick={handleAddFromPreset}
										disabled={presetCount === 0 || isAddingFromPreset}
									>
										{isAddingFromPreset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
										{presetCount === 0
											? "Pick a day to add"
											: selectedPreset.type === "transfer"
												? // A transfer moves money between accounts; no plus or minus.
													`Add ${presetCount} ${presetCount === 1 ? "transfer" : "transfers"}, $${(presetCount * selectedPreset.amount).toFixed(2)}`
												: `Add ${presetCount} ${presetCount === 1 ? "transaction" : "transactions"}, ${
														selectedPreset.type === "expense" ? "-" : "+"
													}$${(presetCount * selectedPreset.amount).toFixed(2)}`}
									</Button>
								)}
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
				defaultType={type}
			/>
		</>
	);
}
