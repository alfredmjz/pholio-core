"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
import { ShortcutHint } from "@/components/common/shortcut-hint";
import { SHORTCUTS, ShortcutId } from "@/lib/keyboard-shortcuts";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import type { AllocationCategory } from "../types";
import type { AccountWithType } from "@/app/balancesheet/types";
import { cn } from "@/lib/utils";

interface AddTransactionButtonProps {
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	className?: string;
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	size?: "default" | "sm" | "lg" | "icon";
	onSuccess?: () => void;
	boundaryMonth?: { year: number; month: number };
}

export function AddTransactionButton({
	categories,
	accounts,
	className,
	variant = "default",
	size = "default",
	onSuccess,
	boundaryMonth,
}: AddTransactionButtonProps) {
	const [open, setOpen] = useState(false);

	useKeyboardShortcut(SHORTCUTS[ShortcutId.OpenTransaction].keys, () => setOpen(true), {
		ignoreTransactionRows: true,
	});

	return (
		<>
			<Button
				onClick={() => setOpen(true)}
				className={cn("gap-2 bg-green-600 hover:bg-green-700 text-white", className)}
				variant={variant}
				size={size}
			>
				<Plus className="h-4 w-4 md:hidden" />
				Add Transaction
				<ShortcutHint
					keys={SHORTCUTS[ShortcutId.OpenTransaction].keys}
					className="hidden md:inline-flex"
					keyClassName="border-current bg-transparent text-current"
				/>
			</Button>

			<UnifiedTransactionDialog
				open={open}
				onOpenChange={setOpen}
				categories={categories}
				accounts={accounts}
				onSuccess={onSuccess}
				context="allocations"
				boundaryMonth={boundaryMonth}
			/>
		</>
	);
}
