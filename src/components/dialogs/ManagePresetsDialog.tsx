"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";
import type { TransactionPreset } from "@/app/allocations/preset-actions";
import { PresetManager, type PresetManagerView } from "./preset-manager";

interface ManagePresetsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	onPresetsChanged?: () => void;
	/** The type a new preset starts as, so it matches what the person was recording. */
	defaultType?: TransactionPreset["type"];
}

const TITLES: Record<PresetManagerView, string> = { list: "Presets", create: "New preset", edit: "Edit preset" };

export function ManagePresetsDialog({
	open,
	onOpenChange,
	categories,
	accounts,
	onPresetsChanged,
	defaultType,
}: ManagePresetsDialogProps) {
	const [view, setView] = useState<PresetManagerView>("list");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>{TITLES[view]}</DialogTitle>
					<DialogDescription>
						{view === "list"
							? "Templates for transactions and transfers you record often."
							: "Save a transaction you repeat, then add it from a preset in a few taps."}
					</DialogDescription>
				</DialogHeader>
				{/* Mounted only while open, so each open starts on a fresh list. */}
				{open && (
					<PresetManager
						categories={categories}
						accounts={accounts}
						onPresetsChanged={onPresetsChanged}
						defaultType={defaultType}
						onViewChange={setView}
						Footer={DialogFooter}
						onClose={() => onOpenChange(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
