"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SettingsContentWrapperProps {
	/** Title of the settings page */
	title: string;
	/** Optional description text */
	description?: string;
	/** Page content - children will be separated by dividers */
	children: React.ReactNode;
	/** Optional className for the root container */
	className?: string;
}

/**
 * Settings Content Wrapper
 *
 * Standardized layout for all settings pages (Profile, Security, etc.)
 * Enforces consistency in headers, spacing, and content grouping.
 *
 * Structure:
 * - Header (Title + Description)
 * - Content Area (Stack of sections with dividers)
 *
 * Usage:
 * Wrap the entire page content in this component.
 * Direct children will be treated as distinct sections separated by borders.
 */
export function SettingsContentWrapper({ title, description, children, className }: SettingsContentWrapperProps) {
	return (
		<div className={cn("space-y-6", className)}>
			{/* Page Header */}
			<div className="space-y-1">
				<h2 className="text-2xl font-bold tracking-tight">{title}</h2>
				{description && <p className="text-muted-foreground">{description}</p>}
			</div>

			{/* Content Area - Auto-divides direct children */}
			<div className="flex flex-col divide-y divide-border">
				{React.Children.map(children, (child, index) => {
					if (!child) return null;

					// Determine padding based on position to ensure even spacing around dividers
					// First item: padding-bottom only (if not alone)
					// Last item: padding-top only (if not alone)
					// Middle items: padding-top and padding-bottom
					const isFirst = index === 0;
					// We can't easily know isLast during map without converting to array and filtering nulls first,
					// but CSS 'first:' and 'last:' selectors on the wrapper generic class handle this better.
					// However, the previous manual implementation used explicit classes.
					// Let's use a uniform wrapper that responds to standard pseudo-classes.

					return <section className="py-8 first:pt-0 last:pb-0">{child}</section>;
				})}
			</div>
		</div>
	);
}
