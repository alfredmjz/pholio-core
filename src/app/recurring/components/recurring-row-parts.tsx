"use client";

import { MoreHorizontal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceLogo } from "@/components/service-logo";
import { formatFrequency } from "@/lib/date-utils";
import type { RecurringExpense } from "../actions";

/** Columns shared by the section header and every row (desktop). */
export const RECURRING_GRID =
	"row-wide:grid row-wide:grid-cols-[minmax(9rem,1.5fr)_minmax(6rem,1fr)_minmax(6rem,1fr)_5.5rem_7.5rem] row-wide:items-center row-wide:gap-3";

/** Logo, name and how often it repeats (plus "Auto" when it's recorded automatically). */
export function RecurringIdentity({
	expense,
	muted = false,
	automated = false,
}: {
	expense: RecurringExpense;
	muted?: boolean;
	automated?: boolean;
}) {
	const meta = expense.meta_data as { domain?: string; no_logo_lookup?: boolean } | null;
	return (
		<div className="flex min-w-0 items-center gap-3">
			<ServiceLogo
				name={expense.name}
				serviceProvider={expense.service_provider}
				domain={meta?.domain}
				disableLookup={meta?.no_logo_lookup}
				className={muted ? "h-9 w-9 shrink-0 opacity-50 grayscale" : "h-9 w-9 shrink-0"}
				width={36}
				height={36}
			/>
			<div className="min-w-0">
				<p
					className={
						muted
							? "type-body-sm truncate font-medium text-muted-foreground"
							: "type-body-sm truncate font-medium text-primary"
					}
				>
					{expense.name}
				</p>
				<p className="type-body-xs flex items-center gap-1.5 text-muted-foreground">
					{formatFrequency(expense.billing_period)}
					{automated && (
						<span className="inline-flex items-center gap-0.5" title="Recorded automatically">
							<span aria-hidden>·</span>
							<Zap className="h-3 w-3" aria-hidden />
							Auto
						</span>
					)}
				</p>
			</div>
		</div>
	);
}

interface RowMenuItem {
	label: string;
	onSelect: () => void;
	disabled?: boolean;
}

/** The "…" menu: actions sorted by name, then Delete in its own group. */
export function RowMenu({
	name,
	items,
	onDelete,
	deleting,
}: {
	name: string;
	items: RowMenuItem[];
	onDelete: () => void;
	deleting?: boolean;
}) {
	const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label));
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
					aria-label={`More actions for ${name}`}
					onClick={(event) => event.stopPropagation()}
				>
					<MoreHorizontal className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
				{sorted.map((item) => (
					<DropdownMenuItem key={item.label} onClick={item.onSelect} disabled={item.disabled}>
						{item.label}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem className="text-error" onClick={onDelete} disabled={deleting}>
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
