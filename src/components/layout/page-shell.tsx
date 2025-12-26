"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
}

export function PageShell({ children, className, ...props }: PageShellProps) {
	return (
		<div className={cn("max-w-7xl mx-auto w-full relative", className)} {...props}>
			{children}
		</div>
	);
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	isSticky?: boolean;
}

export function PageHeader({ children, className, isSticky = true, ...props }: PageHeaderProps) {
	const isMobile = useIsMobile();

	return (
		<div
			className={cn(
				"bg-background pb-6 mb-4",
				// Unified sticky logic
				isSticky && "sticky top-0 z-20",
				// Negative margin hack for desktop integration with parent layout
				!isMobile && "-mt-8 pt-8",
				// Mobile specific adjustments if needed (currently minimal)
				isMobile && "pt-4",
				className
			)}
			{...props}
		>
			{children}
		</div>
	);
}

interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
}

export function PageContent({ children, className, ...props }: PageContentProps) {
	return (
		<div className={cn("space-y-6", className)} {...props}>
			{children}
		</div>
	);
}
