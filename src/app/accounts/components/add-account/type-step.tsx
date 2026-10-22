"use client";

import { Wallet } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { sortAccountTypes } from "@/lib/account-utils";
import type { AccountClass, AccountType, AccountTypeCode } from "../../types";
import { TYPE_ICON } from "../account-row";

/** One line under each type, by its stable code (never its display name). */
const TYPE_HINT: Record<AccountTypeCode, string> = {
	chequing: "Day-to-day spending",
	savings: "Money set aside, with an optional goal",
	investment: "TFSA, RRSP, FHSA or a brokerage account",
	credit_card: "A card balance and its limit",
	line_of_credit: "Borrow as you need it",
	mortgage: "Your home loan",
	loan: "Car, student or personal loan",
	other: "Anything else; pick the fields it tracks",
};

interface TypeStepProps {
	accountClass: AccountClass;
	onClassChange: (accountClass: AccountClass) => void;
	types: AccountType[];
	selectedTypeId: string;
	/** Picking a type moves straight on to the details. */
	onPick: (typeId: string) => void;
	error?: string;
}

/** Step one: something you own or owe, then which kind. */
export function TypeStep({ accountClass, onClassChange, types, selectedTypeId, onPick, error }: TypeStepProps) {
	const shown = sortAccountTypes(types.filter((type) => type.class === accountClass));

	return (
		<div className="flex flex-col gap-5">
			<ToggleGroup
				type="single"
				value={accountClass}
				onValueChange={(value) => value && onClassChange(value as AccountClass)}
				variant="segmented"
				aria-label="Own or owe"
				className="grid grid-cols-2 gap-1 rounded-full border border-border/70 bg-card-muted/50 p-1"
			>
				<ToggleGroupItem value="asset" className="h-9 rounded-full type-control">
					What you own
				</ToggleGroupItem>
				<ToggleGroupItem value="liability" className="h-9 rounded-full type-control">
					What you owe
				</ToggleGroupItem>
			</ToggleGroup>

			<div role="radiogroup" aria-label="Account type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{shown.map((type) => {
					const Icon = TYPE_ICON[(type.code as AccountTypeCode) ?? "other"] ?? Wallet;
					const hint = type.code ? TYPE_HINT[type.code as AccountTypeCode] : undefined;
					const selected = type.id === selectedTypeId;
					return (
						<button
							key={type.id}
							type="button"
							role="radio"
							aria-checked={selected}
							aria-label={type.name}
							aria-describedby={hint ? `type-hint-${type.id}` : undefined}
							onClick={() => onPick(type.id)}
							data-dialog-ignore-enter=""
							className={cn(
								"card-interactive flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left",
								selected ? "border-primary bg-primary/[0.04]" : "border-border bg-card/60",
								error && !selectedTypeId && "border-error/60"
							)}
						>
							<span
								className={cn(
									"flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
									accountClass === "liability" ? "bg-error-muted text-error" : "bg-card-muted text-primary"
								)}
								aria-hidden
							>
								<Icon className="h-4 w-4" />
							</span>
							<span className="min-w-0">
								<span className="type-body-sm block font-medium text-primary">{type.name}</span>
								{hint && (
									<span id={`type-hint-${type.id}`} className="type-body-xs block text-muted-foreground">
										{hint}
									</span>
								)}
							</span>
						</button>
					);
				})}
			</div>
			{error && <p className="type-body-xs -mt-2 text-error">{error}</p>}
		</div>
	);
}
