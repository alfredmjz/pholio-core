"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TransactionDialog } from "./TransactionDialog";
import type { AllocationCategory } from "../types";
import { cn } from "@/lib/utils";

interface AddTransactionButtonProps {
	categories: AllocationCategory[];
	className?: string;
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	size?: "default" | "sm" | "lg" | "icon";
}

export function AddTransactionButton({
	categories,
	className,
	variant = "default",
	size = "default",
}: AddTransactionButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button onClick={() => setOpen(true)} className={cn("gap-2", className)} variant={variant} size={size}>
				<Plus className="h-4 w-4" />
				Add Transaction
			</Button>

			<TransactionDialog open={open} onOpenChange={setOpen} categories={categories} />
		</>
	);
}
