"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { validateDecimalInput } from "@/lib/input-utils";

interface ProminentAmountInputProps {
	value: string;
	onChange: (value: string) => void;
	label?: string;
	currency?: string;
	className?: string;
	id?: string;
	hasError?: boolean;
}

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
				<Label htmlFor={id} className="text-sm font-medium">
					{label}
				</Label>
			)}
			<div className="relative group">
				<span
					className={cn(
						"absolute left-4 top-1/2 -translate-y-1/2 text-lg transition-colors",
						value ? "text-green-500 font-semibold" : "text-primary"
					)}
				>
					{currency}
				</span>
				<Input
					id={id}
					type="text"
					inputMode="decimal"
					placeholder="0.00"
					value={value}
					onChange={(e) => {
						const inputValue = e.target.value;
						if (validateDecimalInput(inputValue)) {
							onChange(inputValue);
						}
					}}
					className={cn("pl-10 h-10 text-lg tracking-tight", hasError ? "border-error" : "")}
				/>
			</div>
		</div>
	);
}
