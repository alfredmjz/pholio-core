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
				className={cn("h-10 w-10 gap-2 rounded-full p-0 sm:w-auto sm:pl-3.5 sm:pr-4", className)}
				variant={variant}
				size={size}
			>
				<Plus className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
				<span className="sr-only sm:not-sr-only">Add transaction</span>
				<ShortcutHint
					keys={SHORTCUTS[ShortcutId.OpenTransaction].keys}
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
