"use client";

import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
	value: T;
	label: string;
	/** Read by screen readers instead of the visible label. */
	ariaLabel?: string;
	icon?: LucideIcon;
	/** A small dot after the label, e.g. for unread items. */
	indicator?: boolean;
}

interface SegmentedChoiceProps<T extends string> {
	label: string;
	value: T | undefined;
	options: SegmentedOption<T>[];
	onChange: (value: T) => void;
	disabled?: boolean;
	className?: string;
	itemClassName?: string;
}

export function SegmentedChoice<T extends string>({
	label,
	value,
	options,
	onChange,
	disabled,
	className,
	itemClassName,
}: SegmentedChoiceProps<T>) {
	return (
		<ToggleGroup
			type="single"
			variant="segmented"
			aria-label={label}
			value={value ?? ""}
			onValueChange={(next) => next && onChange(next as T)}
			disabled={disabled}
			className={cn(
				"inline-flex w-full flex-nowrap gap-0.5 rounded-full border border-border/70 bg-background/60 p-0.5 row-wide:w-auto",
				className
			)}
		>
			{options.map(({ value: option, label: optionLabel, ariaLabel, icon: Icon, indicator }) => (
				<ToggleGroupItem
					key={option}
					value={option}
					aria-label={ariaLabel ?? (indicator ? `${optionLabel}, unread` : optionLabel)}
					className={cn(
						"type-label h-10 flex-1 gap-1.5 whitespace-nowrap rounded-full px-3 row-wide:flex-none row-wide:px-3.5",
						itemClassName
					)}
				>
					{Icon && <Icon className="h-4 w-4" aria-hidden />}
					{optionLabel}
					{indicator && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
