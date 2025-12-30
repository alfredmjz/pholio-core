"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CardSelectorOption<T extends string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
	color?: string;
}

interface CardSelectorProps<T extends string> {
	options: CardSelectorOption<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
	selectedBorderColor?: string;
}

export function CardSelector<T extends string>({
	options,
	value,
	onChange,
	className,
	selectedBorderColor,
}: CardSelectorProps<T>) {
	return (
		<div className={cn("grid grid-cols-2 gap-3", className)}>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					className={cn(
						"relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors",
						value === option.value
							? selectedBorderColor || "border-primary bg-secondary"
							: "border-border/40 bg-secondary/50 hover:bg-secondary"
					)}
				>
					{option.icon && (
						<div
							className={cn(
								"h-12 w-12 rounded-full flex items-center justify-center",
								// Only apply color background for emoji icons (strings)
								typeof option.icon === "string" && option.color ? `bg-${option.color}` : "bg-muted"
							)}
						>
							<span className="text-2xl">{option.icon}</span>
						</div>
					)}
					<span className={cn("text-sm font-medium", value === option.value && "text-primary")}>{option.label}</span>
				</button>
			))}
		</div>
	);
}
