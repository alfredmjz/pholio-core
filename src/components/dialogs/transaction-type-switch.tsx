"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type TransactionKind = "expense" | "income" | "transfer";

const OPTIONS: { value: TransactionKind; label: string; icon: typeof ArrowUpRight }[] = [
	{ value: "expense", label: "Expense", icon: ArrowUpRight },
	{ value: "income", label: "Income", icon: ArrowDownLeft },
	{ value: "transfer", label: "Transfer", icon: ArrowLeftRight },
];

interface TransactionTypeSwitchProps {
	value: TransactionKind;
	onChange: (value: TransactionKind) => void;
	/** Hide options that don't apply (e.g. no transfers when editing a budget-only row). */
	options?: TransactionKind[];
	className?: string;
}

/** Expense / Income / Transfer as one segmented control at the top of a transaction form. */
export function TransactionTypeSwitch({ value, onChange, options, className }: TransactionTypeSwitchProps) {
	const shown = options ? OPTIONS.filter((option) => options.includes(option.value)) : OPTIONS;

	return (
		<div
			role="radiogroup"
			aria-label="Transaction type"
			className={cn("grid gap-1 rounded-full border border-border/70 bg-card-muted/50 p-1", className)}
			style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
		>
			{shown.map((option) => {
				const selected = option.value === value;
				const Icon = option.icon;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(option.value)}
						className={cn(
							"type-control flex h-9 items-center justify-center gap-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-primary"
						)}
					>
						<Icon className="h-4 w-4" aria-hidden />
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
