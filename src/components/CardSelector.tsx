"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CardSelectorOption<T extends string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
	/** Kept for older callers; tiles no longer use a coloured badge. */
	color?: string;
}

interface CardSelectorProps<T extends string> {
	options: CardSelectorOption<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
	/** Kept for older callers; the selected tile always uses the ink outline. */
	selectedBorderColor?: string;
}

/** A row of choice tiles behaving as one radio group. */
export function CardSelector<T extends string>({ options, value, onChange, className }: CardSelectorProps<T>) {
	return (
		<div role="radiogroup" className={cn("grid grid-cols-2 gap-2", className)}>
			{options.map((option) => {
				const selected = value === option.value;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(option.value)}
						className={cn(
							"flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							selected
								? "border-primary bg-card ring-1 ring-primary"
								: "border-border/80 bg-card-muted/30 hover:border-border-strong"
						)}
					>
						{option.icon && (
							<span
								className={cn(
									"flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4",
									selected ? "text-primary" : "text-muted-foreground"
								)}
								aria-hidden
							>
								{option.icon}
							</span>
						)}
						<span className={cn("type-control", selected ? "text-primary" : "text-text-secondary")}>
							{option.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}
