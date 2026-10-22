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

/** A labelled group of fields. The label is quiet so the fields carry the dialog. */
export function FormSection({ icon, title, description, children, variant = "default", className }: FormSectionProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3",
				variant === "default" && "rounded-2xl border border-border/70 bg-card-muted/40 p-4",
				variant === "highlighted" && "rounded-2xl border border-accent/25 bg-accent-muted/50 p-4",
				className
			)}
		>
			{(title || icon) && (
				<div className="flex items-center gap-1.5 text-muted-foreground">
					{icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
					{title && <h3 className="type-label">{title}</h3>}
				</div>
			)}
			{description && <p className="type-body-sm -mt-1 text-muted-foreground">{description}</p>}
			{children}
		</div>
	);
}
