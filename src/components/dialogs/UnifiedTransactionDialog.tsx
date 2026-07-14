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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Info, Settings2, PlusCircle, Trash2 } from "lucide-react";
import { createUnifiedTransaction, getSuggestedAccountForCategory } from "@/lib/actions/unified-transaction-actions";
import { getTransactionPresets, TransactionPreset, createTransactionFromPreset, createTransactionsFromPresetBulk } from "@/app/allocations/preset-actions";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { FormSection } from "@/components/FormSection";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { CardSelector } from "@/components/CardSelector";
import { cn } from "@/lib/utils";
import { getTodayDateString, parseLocalDate, formatDateString } from "@/lib/date-utils";
import { VIRTUAL_UNCATEGORIZED_ID } from "@/app/allocations/types";
import { ManagePresetsDialog } from "./ManagePresetsDialog";


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
	const [isLoading, setIsLoading] = useState(false);
	
	// Manual Entry State
	const [type, setType] = useState<"income" | "expense">(defaultType || "expense");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(defaultDate || getTodayDateString());
	const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || VIRTUAL_UNCATEGORIZED_ID);
	const [accountId, setAccountId] = useState<string>(defaultAccountId || "none");
	const [transactionType, setTransactionType] = useState<string>("deposit");
	const [incomeSource, setIncomeSource] = useState<string>("salary");
	const [notes, setNotes] = useState("");
	const [suggestedAccountInfo, setSuggestedAccountInfo] = useState<string | null>(null);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [activeTab, setActiveTab] = useState("manual");

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
			setTransactionType(defaultType === "income" ? "deposit" : "withdrawal");
			setNotes("");
			setSuggestedAccountInfo(null);
			setErrors({});
			setActiveTab("manual");
			setSelectedDatesMap({});
			loadPresets();
		}
	}, [open, defaultDate, defaultCategoryId, defaultAccountId, defaultType, boundaryMonth]);

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
		if (!categoryId || categoryId === VIRTUAL_UNCATEGORIZED_ID) {
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
		if (!description.trim()) { newErrors.description = "Description is required"; isValid = false; }
		if (!amount || parseFloat(amount) <= 0) { newErrors.amount = "Valid amount is required"; isValid = false; }
		if (!date) { newErrors.date = "Date is required"; isValid = false; }
		if (accountRequired && (accountId === "none" || !accountId)) { newErrors.accountId = "Account is required"; isValid = false; }
		setErrors(newErrors);
		if (!isValid) toast.error("Please fill in all required fields", { description: "Check the form for displayed errors." });
		return isValid;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateForm()) return;
		setIsLoading(true);
		try {
			const numAmount = parseFloat(amount);
			const input: UnifiedTransactionInput = {
				description,
				amount: numAmount,
				date,
				type,
				categoryId: categoryId === VIRTUAL_UNCATEGORIZED_ID ? null : categoryId,
				accountId: accountId === "none" ? null : accountId,
				transactionType: transactionType as any,
				notes: notes || undefined,
				source: isAllocationsContext && type === "income" ? incomeSource : "manual",
			};
			const result = await createUnifiedTransaction(input);
			if (result.success) {
				toast.success("Transaction added");
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

	const incrementDateCount = (dateStr: string) => {
		setSelectedDatesMap(prev => ({
			...prev,
			[dateStr]: (prev[dateStr] || 0) + 1
		}));
	};

	const decrementDateCount = (dateStr: string) => {
		setSelectedDatesMap(prev => {
			const count = prev[dateStr] || 0;
			if (count <= 1) {
				const newMap = { ...prev };
				delete newMap[dateStr];
				return newMap;
			}
			return {
				...prev,
				[dateStr]: count - 1
			};
		});
	};

	const removeDateEntry = (dateStr: string) => {
		setSelectedDatesMap(prev => {
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
				const preset = presets.find(p => p.id === selectedPresetId);
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

	const selectedPreset = presets.find(p => p.id === selectedPresetId);

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[500px]" showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Add Transaction</DialogTitle>
						<DialogDescription>Enter transaction details to update your budget and account balance.</DialogDescription>
					</DialogHeader>

					<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
						<TabsList className="grid w-full grid-cols-2 mb-4">
							<TabsTrigger value="manual">Manual Entry</TabsTrigger>
							<TabsTrigger value="presets">Use Preset</TabsTrigger>
						</TabsList>

						<TabsContent value="manual" className="mt-0">
							<form onSubmit={handleSubmit} className="flex flex-col gap-6">
								<FormSection icon={type === "expense" ? <TrendingDown /> : <TrendingUp />} title="Transaction Type" variant="subtle">
									<CardSelector
										options={[
											{ value: "expense", label: "Expense", icon: "📉", color: "bg-red-100" },
											{ value: "income", label: "Income", icon: "📈", color: "bg-green-100" },
										]}
										value={type} onChange={setType} selectedBorderColor="border-blue-200"
									/>
								</FormSection>

								{!isAllocationsContext && (
									<div className="space-y-2">
										<Label htmlFor="transactionType">{type === "income" ? "Income Type" : "Expense Type"} (Account)</Label>
										<Select value={transactionType} onValueChange={setTransactionType}>
											<SelectTrigger className="h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
											<SelectContent>
												{type === "income" ? (
													<>
														<SelectItem value="deposit">💰 Deposit</SelectItem>
														<SelectItem value="contribution">➕ Contribution</SelectItem>
														<SelectItem value="refund">🔄 Refund</SelectItem>
													</>
												) : (
													<>
														<SelectItem value="withdrawal">💸 Withdrawal</SelectItem>
														<SelectItem value="payment">💳 Payment</SelectItem>
														<SelectItem value="interest">📈 Interest</SelectItem>
													</>
												)}
											</SelectContent>
										</Select>
									</div>
								)}

								{isAllocationsContext && type === "income" && (
									<div className="space-y-2">
										<Label htmlFor="incomeSource">Income Source</Label>
										<Select value={incomeSource} onValueChange={setIncomeSource}>
											<SelectTrigger className="h-10"><SelectValue placeholder="Select source" /></SelectTrigger>
											<SelectContent>
												<SelectItem value="salary">💼 Salary / Expected</SelectItem>
												<SelectItem value="external">🎁 External / One-time</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}

								<FormSection icon={<Info />} title="Transaction Details" variant="subtle">
									<div className="space-y-2">
										<Label htmlFor="amount">Amount <span className="text-error">*</span></Label>
										<ProminentAmountInput value={amount} onChange={(val) => { setAmount(val); if (errors.amount) setErrors({ ...errors, amount: undefined }); }} id="amount" hasError={!!errors.amount} />
										{errors.amount && <p className="text-sm text-error">{errors.amount}</p>}
									</div>

									<div className="flex flex-row justify-between gap-4">
										<div className="flex-1 space-y-2">
											<Label htmlFor="date">Date <span className="text-error">*</span></Label>
											<DatePicker id="date" value={date} onChange={setDate} minDate={boundaryMonth ? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-01` : undefined} maxDate={boundaryMonth ? `${boundaryMonth.year}-${String(boundaryMonth.month).padStart(2, "0")}-${new Date(boundaryMonth.year, boundaryMonth.month, 0).getDate()}` : undefined} />
											{errors.date && <p className="text-sm text-error">{errors.date}</p>}
										</div>
										<div className="flex-1 space-y-2">
											<Label htmlFor="description">Description <span className="text-error">*</span></Label>
											<Input id="description" placeholder="e.g. Grocery Store" value={description} onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors({ ...errors, description: undefined }); }} required className={cn("h-10", errors.description && "border-error")} />
											{errors.description && <p className="text-sm text-error">{errors.description}</p>}
										</div>
									</div>
								</FormSection>

								<div className="space-y-2">
									<Label htmlFor="category">
										Budget Category{categoryRequired && <span className="text-error"> *</span>}
										{showCategoryBadge && !categoryDisabled && (
											<span className="ml-2 text-xs text-primary">
												{selectedCategory?.category_type === "savings_goal" && "(Savings Goal)"}
												{selectedCategory?.category_type === "debt_payment" && "(Debt Payment)"}
											</span>
										)}
									</Label>
									<Select value={categoryDisabled ? VIRTUAL_UNCATEGORIZED_ID : categoryId} onValueChange={setCategoryId} disabled={categoryDisabled}>
										<SelectTrigger className="h-10"><SelectValue placeholder="Select a category" /></SelectTrigger>
										<SelectContent>
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
									<Select value={accountId} onValueChange={(val) => { setAccountId(val); if (errors.accountId) setErrors({ ...errors, accountId: undefined }); }}>
										<SelectTrigger className={cn("h-10", errors.accountId && "border-error")}><SelectValue placeholder={accountRequired ? "Select an account" : "No account selected"} /></SelectTrigger>
										<SelectContent>
											{!accountRequired && <SelectItem value="none">No Account</SelectItem>}
											{[...accounts]
												.sort((a, b) => {
													const aInst = a.institution || "";
													const bInst = b.institution || "";
													if (aInst !== bInst) return aInst.localeCompare(bInst);
													return a.name.localeCompare(b.name);
												})
												.map((acc) => (
													<SelectItem key={acc.id} value={acc.id}>
														{acc.institution ? `${acc.institution} - ${acc.name}` : acc.name}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
									{suggestedAccountInfo && <p className="text-xs text-primary">{suggestedAccountInfo}</p>}
									{errors.accountId && <p className="text-sm text-error">{errors.accountId}</p>}
								</div>

								{accountId === "none" && categoryId !== VIRTUAL_UNCATEGORIZED_ID && (
									<p className="text-sm text-primary flex items-start gap-2 p-3 bg-muted rounded-lg">
										<Info className="h-4 w-4 shrink-0 mt-0.5" />
										<span>Budget-only transaction: Your budget will update, but no account balance will change.</span>
									</p>
								)}

								{notes && (
									<FormSection variant="subtle">
										<div className="space-y-2">
											<Label htmlFor="notes">Notes (Optional)</Label>
											<Textarea id="notes" placeholder="Add any additional details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-secondary border-border/60 resize-none" />
										</div>
									</FormSection>
								)}

								<DialogFooter>
									<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
									<Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Transaction</Button>
								</DialogFooter>
							</form>
						</TabsContent>

						<TabsContent value="presets" className="mt-0 flex flex-col gap-6">
							<div className="flex flex-col gap-2">
								<div className="flex justify-between items-center">
									<Label>Select Preset</Label>
									<Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsManagePresetsOpen(true)}>
										<Settings2 className="h-4 w-4 mr-1" /> Manage
									</Button>
								</div>
								
								{presets.length === 0 ? (
									<div className="text-center p-6 border border-dashed rounded-lg bg-muted/30">
										<p className="text-sm text-muted-foreground mb-4">You don't have any presets yet.</p>
										<Button onClick={() => setIsManagePresetsOpen(true)} size="sm">
											<PlusCircle className="h-4 w-4 mr-2" /> Create Preset
										</Button>
									</div>
								) : (
									<Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
										<SelectTrigger>
											<SelectValue placeholder="Choose a transaction preset" />
										</SelectTrigger>
										<SelectContent>
											{presets.map(p => (
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
									<div className="bg-muted/50 p-3 rounded-lg border text-sm">
										<p><strong>{selectedPreset.description}</strong></p>
										<p className="text-muted-foreground mt-1">
											{selectedPreset.type === 'expense' ? '📉' : '📈'} ${selectedPreset.amount.toFixed(2)} • {selectedPreset.transaction_type}
										</p>
										<p className="text-xs text-primary mt-2">
											<span className="font-medium">Instructions:</span> Click dates on the calendar below to select. Click a date multiple times to add multiple items on that day. Adjust totals in the list below before confirming.
										</p>
									</div>

									<div className="flex justify-center border rounded-lg p-2 bg-background relative">
										{isAddingFromPreset && (
											<div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
												<Loader2 className="h-6 w-6 animate-spin text-primary" />
											</div>
										)}
										<Calendar
											className="rounded-md"
											mode="multiple"
											selected={Object.keys(selectedDatesMap)
												.filter(dateStr => selectedDatesMap[dateStr] > 0)
												.map(dateStr => parseLocalDate(dateStr))}
											onSelect={(dates) => {
												if (!dates) {
													setSelectedDatesMap({});
													return;
												}
												const newMap: Record<string, number> = {};
												dates.forEach(d => {
													const dateStr = formatDateString(d);
													newMap[dateStr] = selectedDatesMap[dateStr] || 1;
												});
												setSelectedDatesMap(newMap);
											}}
											defaultMonth={boundaryMonth ? new Date(boundaryMonth.year, boundaryMonth.month - 1) : undefined}
										/>
									</div>

									{/* Selected Dates summary */}
									{Object.keys(selectedDatesMap).length > 0 && (
										<div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto border rounded-lg p-2 bg-muted/20">
											<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Selected Days</p>
											{Object.entries(selectedDatesMap)
												.filter(([_, count]) => count > 0)
												.map(([dateStr, count]) => {
													const subtotal = selectedPreset.amount * count;
													return (
														<div key={dateStr} className="flex justify-between items-center bg-background border p-2 rounded-md text-xs">
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
										Confirm & Add {Object.values(selectedDatesMap).reduce((a, b) => a + b, 0)} Items 
										({selectedPreset.type === 'expense' ? '-' : '+'}${ (Object.values(selectedDatesMap).reduce((a, b) => a + b, 0) * selectedPreset.amount).toFixed(2) })
									</Button>
								</div>
							)}
							<DialogFooter className="mt-4">
								<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
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
