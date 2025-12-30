"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
	icon?: React.ReactNode;
	title?: string;
	description?: string;
	children: React.ReactNode;
	variant?: "default" | "highlighted" | "subtle";
	className?: string;
}

export function FormSection({ icon, title, description, children, variant = "default", className }: FormSectionProps) {
	return (
		<div
			className={cn(
				"rounded-lg flex flex-col gap-3",
				variant === "default" && "bg-secondary border border-border/60",
				variant === "highlighted" && "bg-accent/10 border border-accent/30",
				variant === "subtle" && "bg-transparent border-0",
				className
			)}
		>
			{(title || icon) && (
				<div className="flex items-center gap-2">
					{icon && <span className="text-primary">{icon}</span>}
					{title && <h3 className="text-base font-semibold text-primary">{title}</h3>}
				</div>
			)}
			{description && <p className="text-sm text-primary">{description}</p>}
			{children}
		</div>
	);
}
