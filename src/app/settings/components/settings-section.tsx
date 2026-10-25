"use client";

import { SurfaceSection } from "@/components/layout/surface-section";
import { cn } from "@/lib/utils";
import type { SettingsSectionId } from "../sections";
import { useFormatSettings } from "@/components/providers/format-provider";

interface SettingsSectionProps {
	id: SettingsSectionId;
	title: string;
	note?: string;
	headerActions?: React.ReactNode;
	children: React.ReactNode;
}

/** A Settings group the jump list links to; the scroll margin keeps its heading off the screen edge. */
export function SettingsSection({ id, title, note, headerActions, children }: SettingsSectionProps) {
	useFormatSettings();
	return (
		<div id={id} className="scroll-mt-6 xl:scroll-mt-10">
			<SurfaceSection
				id={`${id}-heading`}
				title={title}
				note={note}
				headerActions={headerActions}
				className="rows-container"
			>
				<div className="divide-y divide-border/50">{children}</div>
			</SurfaceSection>
		</div>
	);
}

interface SettingRowProps {
	label: string;
	/** The control's id, so the label is announced with it. */
	htmlFor?: string;
	description?: React.ReactNode;
	/** Stack the control under the label at every width, for wide controls such as lists. */
	stacked?: boolean;
	className?: string;
	children?: React.ReactNode;
}

/** One setting: its label and description, and the control that changes it. */
export function SettingRow({ label, htmlFor, description, stacked, className, children }: SettingRowProps) {
	const Label = htmlFor ? "label" : "p";
	return (
		<div
			className={cn(
				"flex flex-col gap-3 py-4 first:pt-0 last:pb-0",
				!stacked && "row-wide:flex-row row-wide:items-center row-wide:justify-between row-wide:gap-8",
				className
			)}
		>
			<div className="min-w-0 row-wide:max-w-[28rem]">
				<Label htmlFor={htmlFor} className="type-body font-medium text-primary">
					{label}
				</Label>
				{description && <div className="type-body-sm mt-0.5 text-muted-foreground">{description}</div>}
			</div>
			{children && <div className={cn("min-w-0", !stacked && "row-wide:shrink-0")}>{children}</div>}
		</div>
	);
}
