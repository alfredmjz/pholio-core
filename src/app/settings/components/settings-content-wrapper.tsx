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
				{description && <p className="text-primary">{description}</p>}
			</div>

			{/* Content Area - Auto-divides direct children */}
			<div className="flex flex-col">
				{React.Children.map(children, (child) => {
					if (!child) return null;
					return <section className="py-8 first:pt-0 last:pb-0">{child}</section>;
				})}
			</div>
		</div>
	);
}
