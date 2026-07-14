"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import {
	TransactionPreset,
	createTransactionPreset,
	updateTransactionPreset,
	deleteTransactionPreset,
	getTransactionPresets,
	CreateTransactionPresetInput
} from "@/app/allocations/preset-actions";
import { VIRTUAL_UNCATEGORIZED_ID } from "@/app/allocations/types";

interface ManagePresetsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	onPresetsChanged?: () => void;
}

export function ManagePresetsDialog({
	open,
	onOpenChange,
	categories,
	accounts,
	onPresetsChanged,
}: ManagePresetsDialogProps) {
	const [presets, setPresets] = useState<TransactionPreset[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [editingPreset, setEditingPreset] = useState<TransactionPreset | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	// Form State
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [type, setType] = useState<"income" | "expense">("expense");
	const [transactionType, setTransactionType] = useState<string>("withdrawal");
	const [categoryId, setCategoryId] = useState<string>(VIRTUAL_UNCATEGORIZED_ID);
	const [accountId, setAccountId] = useState<string>("none");

	const loadPresets = async () => {
		setIsLoading(true);
		const result = await getTransactionPresets();
		if (result.success && result.data) {
			setPresets(result.data);
		}
		setIsLoading(false);
	};

	useEffect(() => {
		if (open) {
			loadPresets();
			resetForm();
			setIsCreating(false);
			setEditingPreset(null);
		}
	}, [open]);

	const resetForm = () => {
		setName("");
		setDescription("");
		setAmount("");
		setType("expense");
		setTransactionType("withdrawal");
		setCategoryId(VIRTUAL_UNCATEGORIZED_ID);
		setAccountId("none");
	};

	const startEditing = (preset: TransactionPreset) => {
		setEditingPreset(preset);
		setIsCreating(false);
		setName(preset.name);
		setDescription(preset.description);
		setAmount(preset.amount.toString());
		setType(preset.type);
		setTransactionType(preset.transaction_type);
		setCategoryId(preset.category_id || VIRTUAL_UNCATEGORIZED_ID);
		setAccountId(preset.account_id || "none");
	};

	const startCreating = () => {
		setIsCreating(true);
		setEditingPreset(null);
		resetForm();
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this preset?")) return;
		const res = await deleteTransactionPreset(id);
		if (res.success) {
			toast.success("Preset deleted");
			loadPresets();
			onPresetsChanged?.();
		} else {
			toast.error("Failed to delete", { description: res.error });
		}
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name || !description || !amount) {
			toast.error("Please fill required fields");
			return;
		}

		setIsSaving(true);
		const input: CreateTransactionPresetInput = {
			name,
			description,
			amount: parseFloat(amount),
			type,
			transaction_type: transactionType,
			category_id: categoryId === VIRTUAL_UNCATEGORIZED_ID ? null : categoryId,
			account_id: accountId === "none" ? null : accountId,
		};

		let res;
		if (isCreating) {
			res = await createTransactionPreset(input);
		} else if (editingPreset) {
			res = await updateTransactionPreset(editingPreset.id, input);
		}

		if (res?.success) {
			toast.success(isCreating ? "Preset created" : "Preset updated");
			loadPresets();
			onPresetsChanged?.();
			setIsCreating(false);
			setEditingPreset(null);
		} else {
			toast.error("Failed to save", { description: res?.error });
		}
		setIsSaving(false);
	};

	const showForm = isCreating || editingPreset;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{showForm ? (isCreating ? "Create Preset" : "Edit Preset") : "Manage Presets"}</DialogTitle>
					<DialogDescription>
						{showForm ? "Enter details for the transaction preset." : "Create templates for frequently used transactions."}
					</DialogDescription>
				</DialogHeader>

				{!showForm ? (
					<div className="space-y-4">
						<div className="flex justify-end">
							<Button onClick={startCreating} size="sm">
								<Plus className="h-4 w-4 mr-2" /> New Preset
							</Button>
						</div>
						{isLoading ? (
							<div className="flex justify-center p-8">
								<Loader2 className="h-8 w-8 animate-spin text-primary/50" />
							</div>
						) : presets.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
								No presets created yet
							</div>
						) : (
							<div className="space-y-2">
								{presets.map((preset) => (
									<div key={preset.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
										<div>
											<p className="font-medium text-sm">{preset.name}</p>
											<p className="text-xs text-muted-foreground">{preset.description} • ${preset.amount.toFixed(2)}</p>
										</div>
										<div className="flex items-center gap-1">
											<Button variant="ghost" size="icon" onClick={() => startEditing(preset)}>
												<Edit2 className="h-4 w-4 text-primary/70" />
											</Button>
											<Button variant="ghost" size="icon" onClick={() => handleDelete(preset.id)}>
												<Trash2 className="h-4 w-4 text-error/70" />
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
						<DialogFooter className="mt-4">
							<Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={handleSave} className="flex flex-col gap-6">
						<div className="space-y-2">
							<Label>Preset Name <span className="text-error">*</span></Label>
							<Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Metro Fare" required />
						</div>

						<FormSection title="Transaction Details" variant="subtle">
							<CardSelector
								options={[
									{ value: "expense", label: "Expense", icon: "📉", color: "bg-red-100" },
									{ value: "income", label: "Income", icon: "📈", color: "bg-green-100" },
								]}
								value={type}
								onChange={(v) => {
									setType(v as "income"|"expense");
									setTransactionType(v === "income" ? "deposit" : "withdrawal");
								}}
							/>
							
							<div className="space-y-2 mt-4">
								<Label>Type <span className="text-error">*</span></Label>
								<Select value={transactionType} onValueChange={setTransactionType}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										{type === "expense" ? (
											<>
												<SelectItem value="withdrawal">💸 Withdrawal</SelectItem>
												<SelectItem value="payment">💳 Payment</SelectItem>
											</>
										) : (
											<>
												<SelectItem value="deposit">💰 Deposit</SelectItem>
												<SelectItem value="refund">🔄 Refund</SelectItem>
											</>
										)}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2 mt-4">
								<Label>Description <span className="text-error">*</span></Label>
								<Input value={description} onChange={e => setDescription(e.target.value)} required />
							</div>

							<div className="space-y-2 mt-4">
								<Label>Amount <span className="text-error">*</span></Label>
								<ProminentAmountInput value={amount} onChange={setAmount} id="preset-amount" />
							</div>
						</FormSection>

						<div className="space-y-2">
							<Label>Category</Label>
							<Select value={categoryId} onValueChange={setCategoryId}>
								<SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
								<SelectContent>
									<SelectItem value={VIRTUAL_UNCATEGORIZED_ID}>Uncategorized</SelectItem>
									{categories
										.filter(c => c.id !== VIRTUAL_UNCATEGORIZED_ID && c.name.toLowerCase() !== "uncategorized")
										.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Account</Label>
							<Select value={accountId} onValueChange={setAccountId}>
								<SelectTrigger><SelectValue placeholder="No Account" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="none">No Account</SelectItem>
									{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>

						<DialogFooter>
							<Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setEditingPreset(null); }} disabled={isSaving}>Cancel</Button>
							<Button type="submit" disabled={isSaving}>
								{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Preset
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
