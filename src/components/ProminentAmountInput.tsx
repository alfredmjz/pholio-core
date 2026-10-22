"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { sanitizeDecimalInput } from "@/lib/input-utils";

interface ProminentAmountInputProps {
	value: string;
	onChange: (value: string) => void;
	label?: string;
	currency?: string;
	className?: string;
	id?: string;
	hasError?: boolean;
}

/** The dialog's hero field: a large amount on a single rule that lights up on focus. */
export function ProminentAmountInput({
	value,
	onChange,
	label,
	currency = "$",
	className,
	id,
	hasError,
}: ProminentAmountInputProps) {
	return (
		<div className={cn("space-y-2", className)}>
			{label && (
				<Label htmlFor={id} className="type-label text-muted-foreground">
					{label}
				</Label>
			)}
			<div className="field-amount" data-invalid={hasError ? "true" : undefined}>
				<span className="field-amount-currency" aria-hidden>
					{currency}
				</span>
				<input
					id={id}
					type="text"
					inputMode="decimal"
					autoComplete="off"
					placeholder="0.00"
					value={value}
					aria-invalid={hasError || undefined}
					onChange={(e) => onChange(sanitizeDecimalInput(e.target.value, 2))}
					className="field-amount-input"
				/>
			</div>
		</div>
	);
}
