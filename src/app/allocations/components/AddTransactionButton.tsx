"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
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
}

export function AddTransactionButton({
	categories,
	accounts,
	className,
	variant = "default",
	size = "default",
	onSuccess,
}: AddTransactionButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button onClick={() => setOpen(true)} className={cn("gap-2", className)} variant={variant} size={size}>
				<Plus className="h-4 w-4" />
				Add Transaction
			</Button>

			<UnifiedTransactionDialog
				open={open}
				onOpenChange={setOpen}
				categories={categories}
				accounts={accounts}
				onSuccess={onSuccess}
				context="allocations"
			/>
		</>
	);
}
