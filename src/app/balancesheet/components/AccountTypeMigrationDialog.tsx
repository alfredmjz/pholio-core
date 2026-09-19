"use client";

import { useEffect, useState } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CardSelector } from "@/components/CardSelector";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAccountTypes, migrateAccountTypes } from "../actions";
import type {
	AccountClass,
	AccountFieldConfig,
	AccountType,
	AccountTypeMigrationItem,
	AccountTypeMigrationUpdate,
} from "../types";
import { sortAccountTypes } from "@/lib/account-utils";
import { AccountFieldConfigurator } from "./AccountFieldConfigurator";

// TODO(#99-cleanup): remove with the migration notice once no account needs re-typing.
interface MigrationRow {
	accountId: string;
	accountName: string;
	previousTypeName: string;
	balanceLabel: string;
	originalClass: AccountClass;
	accountClass: AccountClass;
	typeId: string;
	fieldConfig: AccountFieldConfig;
}

interface AccountTypeMigrationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: AccountTypeMigrationItem[];
	onComplete: () => void;
}

function formatAmount(amount: number, currency: string) {
	return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
}

function buildRows(items: AccountTypeMigrationItem[], types: AccountType[]): MigrationRow[] {
	return items.map(({ account, suggestedCode }) => {
		const accountClass = (account.account_type?.class ?? "asset") as AccountClass;
		const match = types.find((type) => type.code === suggestedCode && type.class === accountClass);

		return {
			accountId: account.id,
			accountName: account.name,
			previousTypeName: account.account_type?.name ?? "Unknown",
			balanceLabel: formatAmount(account.current_balance, account.currency ?? "USD"),
			originalClass: accountClass,
			accountClass,
			typeId: match?.id ?? "",
			fieldConfig: account.field_visibility ?? {},
		};
	});
}

export function AccountTypeMigrationDialog({ open, onOpenChange, items, onComplete }: AccountTypeMigrationDialogProps) {
	const [types, setTypes] = useState<AccountType[]>([]);
	const [rows, setRows] = useState<MigrationRow[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		const load = async () => {
			const loadedTypes = await getAccountTypes();
			setTypes(loadedTypes);
			setRows(buildRows(items, loadedTypes));
		};
		void load();
	}, [open, items]);

	const selectedType = (row: MigrationRow) => types.find((type) => type.id === row.typeId) ?? null;

	const typesForClass = (accountClass: AccountClass) =>
		sortAccountTypes(types.filter((type) => type.class === accountClass));

	const updateRow = (accountId: string, patch: Partial<MigrationRow>) =>
		setRows((prev) => prev.map((row) => (row.accountId === accountId ? { ...row, ...patch } : row)));

	const handleClassChange = (row: MigrationRow, nextClass: AccountClass) => {
		// Keep the current code when it exists for the newly chosen class, otherwise clear the
		// selection so the owner makes an explicit choice.
		const currentCode = selectedType(row)?.code;
		const match = types.find((type) => type.class === nextClass && type.code === currentCode);
		updateRow(row.accountId, { accountClass: nextClass, typeId: match?.id ?? "" });
	};

	const isValid = rows.length > 0 && rows.every((row) => row.typeId !== "");

	const handleSave = async () => {
		if (!isValid) {
			toast.error("Select a type for every account", {
				description: "Each listed account needs a class and a type.",
			});
			return;
		}

		setIsSaving(true);
		try {
			const updates: AccountTypeMigrationUpdate[] = rows.map((row) => ({
				accountId: row.accountId,
				typeId: row.typeId,
				fieldVisibility: selectedType(row)?.code === "other" ? row.fieldConfig : null,
			}));

			const success = await migrateAccountTypes(updates);
			if (success) {
				toast.success("Account types updated");
				onOpenChange(false);
				onComplete();
			} else {
				toast.error("Update Failed", { description: "Could not update every account. Please try again." });
			}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Update your account types"
			description="We replaced the old account-type list with seven core types plus a fully customisable Other. Choose a class and a type for each account below."
		>
			<div className="flex flex-col gap-4 py-2">
				<div className="flex max-h-[55vh] flex-col divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/60">
					{rows.map((row) => {
						const rowType = selectedType(row);
						const classChanged = row.accountClass !== row.originalClass;

						return (
							<div key={row.accountId} className="flex flex-col gap-3 p-4">
								<div className="flex flex-col">
									<span className="text-sm font-semibold text-primary">{row.accountName}</span>
									<span className="text-xs text-muted-foreground">
										was &ldquo;{row.previousTypeName}&rdquo; · {row.balanceLabel}
									</span>
								</div>

								<div className="space-y-2">
									<Label>Class</Label>
									<CardSelector
										options={[
											{ value: "asset" as AccountClass, label: "Asset", icon: "💰", color: "green-100" },
											{ value: "liability" as AccountClass, label: "Liability", icon: "💳", color: "red-100" },
										]}
										value={row.accountClass}
										onChange={(value) => handleClassChange(row, value)}
									/>
								</div>

								<div className="space-y-2">
									<Label>Type</Label>
									<Select value={row.typeId} onValueChange={(value) => updateRow(row.accountId, { typeId: value })}>
										<SelectTrigger className="h-10">
											<SelectValue placeholder="Select a type" />
										</SelectTrigger>
										<SelectContent>
											{typesForClass(row.accountClass).map((type) => (
												<SelectItem key={type.id} value={type.id}>
													{type.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{rowType?.code === "other" && (
									<div className="space-y-2">
										<Label>Fields to track</Label>
										<AccountFieldConfigurator
											value={row.fieldConfig}
											onChange={(next) => updateRow(row.accountId, { fieldConfig: next })}
										/>
									</div>
								)}

								{classChanged && (
									<p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
										<AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
										<span>
											This changes the account from {row.originalClass} to {row.accountClass}, which affects how it
											counts toward your net worth.
										</span>
									</p>
								)}
							</div>
						);
					})}
				</div>

				<DialogFooter className="pt-2">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Later
					</Button>
					<Button type="button" onClick={handleSave} disabled={isSaving || !isValid} className="gap-2">
						{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
						Save types
					</Button>
				</DialogFooter>
			</div>
		</ControlBasedDialog>
	);
}
