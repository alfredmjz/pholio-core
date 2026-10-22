"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { TransactionTypeSwitch } from "@/components/dialogs/transaction-type-switch";
import { formatAccountDisplayName, sortAccounts } from "@/lib/account-utils";
import { compareAlphabetically } from "@/lib/sort-utils";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";
import {
	TransactionPreset,
	createTransactionPreset,
	updateTransactionPreset,
	deleteTransactionPreset,
	getTransactionPresets,
	CreateTransactionPresetInput,
} from "@/app/allocations/preset-actions";
import { VIRTUAL_UNCATEGORIZED_ID } from "@/app/allocations/types";
import { TransferRoute } from "./transfer-route";

type PresetKind = TransactionPreset["type"];

interface ManagePresetsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	onPresetsChanged?: () => void;
	/** The type a new preset starts as, so it matches what the person was recording. */
	defaultType?: PresetKind;
}

const KIND_ICON = { expense: ArrowUpRight, income: ArrowDownLeft, transfer: ArrowLeftRight } as const;

/** The default account entry type for each kind; transfers are always "transfer". */
const DEFAULT_ENTRY_TYPE: Record<PresetKind, string> = {
	expense: "withdrawal",
	income: "deposit",
	transfer: "transfer",
};

export function ManagePresetsDialog({
	open,
	onOpenChange,
	categories,
	accounts,
	onPresetsChanged,
	defaultType = "expense",
}: ManagePresetsDialogProps) {
	const [presets, setPresets] = useState<TransactionPreset[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [editingPreset, setEditingPreset] = useState<TransactionPreset | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [deleting, setDeleting] = useState<TransactionPreset | null>(null);

	// Form state
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [type, setType] = useState<PresetKind>(defaultType);
	const [transactionType, setTransactionType] = useState<string>(DEFAULT_ENTRY_TYPE[defaultType]);
	const [categoryId, setCategoryId] = useState<string>(VIRTUAL_UNCATEGORIZED_ID);
	const [extraCategory, setExtraCategory] = useState<{ id: string; name: string } | null>(null);
	const [accountId, setAccountId] = useState<string>("none");
	const [toAccountId, setToAccountId] = useState<string>("none");
	const [routeErrors, setRouteErrors] = useState<{ fromAccountId?: string; toAccountId?: string }>({});

	const accountName = (id: string | null | undefined) => accounts.find((a) => a.id === id)?.name ?? "Missing account";

	const loadPresets = async () => {
		setIsLoading(true);
		const result = await getTransactionPresets();
		if (result.success && result.data) setPresets(result.data);
		setIsLoading(false);
	};

	const resetForm = (kind: PresetKind = defaultType) => {
		setName("");
		setDescription("");
		setAmount("");
		setType(kind);
		setTransactionType(DEFAULT_ENTRY_TYPE[kind]);
		setCategoryId(VIRTUAL_UNCATEGORIZED_ID);
		setExtraCategory(null);
		setAccountId("none");
		setToAccountId("none");
		setRouteErrors({});
	};

	useEffect(() => {
		if (open) {
			loadPresets();
			resetForm();
			setIsCreating(false);
			setEditingPreset(null);
		}
	}, [open]);

	const changeType = (kind: PresetKind) => {
		setType(kind);
		setTransactionType(DEFAULT_ENTRY_TYPE[kind]);
		setRouteErrors({});
	};

	const startEditing = (preset: TransactionPreset) => {
		setEditingPreset(preset);
		setIsCreating(false);
		setName(preset.name);
		setDescription(preset.description);
		setAmount(preset.amount.toString());
		setType(preset.type);
		setTransactionType(preset.transaction_type);
		setRouteErrors({});

		// A category from another month is matched by name, or kept and shown as-is.
		let resolvedCategoryId = preset.category_id || VIRTUAL_UNCATEGORIZED_ID;
		setExtraCategory(null);
		if (preset.category_id && preset.category?.name) {
			const matchingCategory = categories.find((c) => c.name.toLowerCase() === preset.category?.name?.toLowerCase());
			if (matchingCategory) {
				resolvedCategoryId = matchingCategory.id;
			} else {
				setExtraCategory({ id: preset.category_id, name: preset.category.name });
			}
		}
		setCategoryId(resolvedCategoryId);
		setAccountId(preset.account_id || "none");
		setToAccountId(preset.to_account_id || "none");
	};

	const startCreating = () => {
		setIsCreating(true);
		setEditingPreset(null);
		resetForm();
	};

	const backToList = () => {
		setIsCreating(false);
		setEditingPreset(null);
	};

	const handleDelete = async () => {
		if (!deleting) return;
		const res = await deleteTransactionPreset(deleting.id);
		if (res.success) {
			toast.success("Preset deleted");
			loadPresets();
			onPresetsChanged?.();
		} else {
			toast.error("Couldn't delete the preset", { description: res.error });
		}
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !amount || (type !== "transfer" && !description.trim())) {
			toast.error("Fill in the required fields");
			return;
		}
		if (type === "transfer" && (accountId === "none" || toAccountId === "none")) {
			setRouteErrors({
				fromAccountId: accountId === "none" ? "Choose where the money comes from" : undefined,
				toAccountId: toAccountId === "none" ? "Choose where the money lands" : undefined,
			});
			return;
		}

		setIsSaving(true);
		const isTransfer = type === "transfer";
		const input: CreateTransactionPresetInput = {
			name: name.trim(),
			description: description.trim() || (isTransfer ? name.trim() : ""),
			amount: parseFloat(amount),
			type,
			transaction_type: transactionType,
			category_id: isTransfer || categoryId === VIRTUAL_UNCATEGORIZED_ID ? null : categoryId,
			account_id: accountId === "none" ? null : accountId,
			to_account_id: isTransfer && toAccountId !== "none" ? toAccountId : null,
		};

		const res = isCreating
			? await createTransactionPreset(input)
			: editingPreset
				? await updateTransactionPreset(editingPreset.id, input)
				: undefined;

		if (res?.success) {
			toast.success(isCreating ? "Preset created" : "Preset updated");
			loadPresets();
			onPresetsChanged?.();
			backToList();
		} else {
			toast.error("Couldn't save the preset", { description: res?.error });
		}
		setIsSaving(false);
	};

	const showForm = isCreating || !!editingPreset;

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
					<DialogHeader>
						<DialogTitle>{showForm ? (isCreating ? "New preset" : "Edit preset") : "Presets"}</DialogTitle>
						<DialogDescription>
							{showForm
								? "Save a transaction you repeat, then add it from a preset in a few taps."
								: "Templates for transactions and transfers you record often."}
						</DialogDescription>
					</DialogHeader>

					{!showForm ? (
						<div className="flex flex-col gap-4">
							{isLoading ? (
								<div className="flex justify-center py-10">
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								</div>
							) : presets.length === 0 ? (
								<p className="type-body-sm py-4 text-muted-foreground">
									No presets yet. Make one for something you record often, like a transit fare or a monthly savings
									transfer.
								</p>
							) : (
								<ul className="-mx-2 flex flex-col divide-y divide-border/50">
									{[...presets]
										.sort((a, b) => compareAlphabetically(a.name, b.name))
										.map((preset) => {
											const Icon = KIND_ICON[preset.type];
											return (
												<li key={preset.id} className="flex items-center gap-3 px-2 py-3">
													<span
														className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-muted text-muted-foreground"
														aria-hidden
													>
														<Icon className="h-4 w-4" />
													</span>
													<span className="min-w-0 flex-1">
														<span className="type-body-sm block truncate font-medium text-primary">{preset.name}</span>
														<span className="type-body-xs flex min-w-0 items-center gap-1 text-muted-foreground">
															<span className="shrink-0">${preset.amount.toFixed(2)},</span>
															{preset.type === "transfer" ? (
																<>
																	<span className="truncate">{accountName(preset.account_id)}</span>
																	<ArrowRight className="h-3 w-3 shrink-0" aria-label="to" />
																	<span className="truncate">{accountName(preset.to_account_id)}</span>
																</>
															) : (
																<span className="truncate">
																	{[preset.type === "income" ? "Income" : "Expense", preset.category?.name]
																		.filter(Boolean)
																		.join(", ")}
																</span>
															)}
														</span>
													</span>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
														onClick={() => startEditing(preset)}
														aria-label={`Edit ${preset.name}`}
													>
														<Pencil className="h-3.5 w-3.5" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 rounded-full text-muted-foreground hover:text-error"
														onClick={() => setDeleting(preset)}
														aria-label={`Delete ${preset.name}`}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</li>
											);
										})}
								</ul>
							)}
							<DialogFooter>
								<Button variant="outline" onClick={() => onOpenChange(false)}>
									Close
									<CancelShortcut />
								</Button>
								<Button onClick={startCreating}>
									<Plus className="h-4 w-4" aria-hidden />
									New preset
								</Button>
							</DialogFooter>
						</div>
					) : (
						<form onSubmit={handleSave} className="flex flex-col gap-6">
							<TransactionTypeSwitch value={type} onChange={changeType} />

							<div className="space-y-2">
								<Label htmlFor="preset-name">
									Name <span className="text-error">*</span>
								</Label>
								<Input
									id="preset-name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={type === "transfer" ? "e.g. TFSA top-up" : "e.g. Metro fare"}
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="preset-amount" className="type-label text-muted-foreground">
									Amount
								</Label>
								<ProminentAmountInput value={amount} onChange={setAmount} id="preset-amount" />
							</div>

							{type === "transfer" ? (
								<TransferRoute
									accounts={accounts}
									fromAccountId={accountId}
									toAccountId={toAccountId}
									onFromChange={(id) => {
										setAccountId(id);
										setRouteErrors((prev) => ({ ...prev, fromAccountId: undefined }));
									}}
									onToChange={(id) => {
										setToAccountId(id);
										setRouteErrors((prev) => ({ ...prev, toAccountId: undefined }));
									}}
									onSwap={() => {
										setAccountId(toAccountId);
										setToAccountId(accountId);
										setRouteErrors({});
									}}
									errors={routeErrors}
								/>
							) : (
								<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="preset-entry-type">Recorded as</Label>
										<Select value={transactionType} onValueChange={setTransactionType}>
											<SelectTrigger id="preset-entry-type">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{type === "expense" ? (
													<>
														<SelectItem value="payment">Payment</SelectItem>
														<SelectItem value="withdrawal">Withdrawal</SelectItem>
													</>
												) : (
													<>
														<SelectItem value="deposit">Deposit</SelectItem>
														<SelectItem value="refund">Refund</SelectItem>
													</>
												)}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="preset-description">
											Description <span className="text-error">*</span>
										</Label>
										<Input
											id="preset-description"
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											placeholder="Shown on each transaction"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="preset-category">Budget category</Label>
										<Select value={categoryId} onValueChange={setCategoryId}>
											<SelectTrigger id="preset-category">
												<SelectValue placeholder="Uncategorized" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={VIRTUAL_UNCATEGORIZED_ID}>Uncategorized</SelectItem>
												{extraCategory && (
													<SelectItem value={extraCategory.id}>{extraCategory.name} (other month)</SelectItem>
												)}
												{categories
													.filter((c) => c.id !== VIRTUAL_UNCATEGORIZED_ID && c.name.toLowerCase() !== "uncategorized")
													.sort((a, b) => compareAlphabetically(a.name, b.name))
													.map((c) => (
														<SelectItem key={c.id} value={c.id}>
															{c.name}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="preset-account">
											Account <span className="font-normal text-muted-foreground">(optional)</span>
										</Label>
										<Select value={accountId} onValueChange={setAccountId}>
											<SelectTrigger id="preset-account">
												<SelectValue placeholder="No account" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">No account</SelectItem>
												{sortAccounts(accounts).map((a) => (
													<SelectItem key={a.id} value={a.id}>
														{formatAccountDisplayName(a)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							)}

							{type === "transfer" && (
								<div className="space-y-2">
									<Label htmlFor="preset-description">
										Description <span className="font-normal text-muted-foreground">(optional)</span>
									</Label>
									<Input
										id="preset-description"
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Defaults to the preset name"
									/>
								</div>
							)}

							<DialogFooter>
								<Button type="button" variant="outline" onClick={backToList} disabled={isSaving}>
									Back
								</Button>
								<Button type="submit" disabled={isSaving}>
									{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
									Save preset
									<SubmitShortcut />
								</Button>
							</DialogFooter>
						</form>
					)}
				</DialogContent>
			</Dialog>

			<DeleteConfirmDialog
				open={deleting !== null}
				onOpenChange={(next) => !next && setDeleting(null)}
				title="Delete preset"
				description={deleting ? `Delete "${deleting.name}"? Transactions already added from it stay.` : ""}
				onConfirm={handleDelete}
			/>
		</>
	);
}
