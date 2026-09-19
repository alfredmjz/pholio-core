"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AccountFieldConfig } from "../types";

interface FieldOption {
	key: keyof AccountFieldConfig;
	label: string;
	hint: string;
}

const FIELD_OPTIONS: FieldOption[] = [
	{ key: "showTargetGoal", label: "Target goal", hint: "Track a savings goal amount" },
	{ key: "showCreditLimit", label: "Credit limit", hint: "Total credit available" },
	{ key: "showOriginalAmount", label: "Original amount", hint: "Initial principal / balance" },
	{ key: "showInterestRate", label: "Interest rate", hint: "APR / APY %" },
	{ key: "showLoanTerm", label: "Loan term", hint: "Term in months" },
	{ key: "showDueDate", label: "Payment due date", hint: "Day of the month" },
	{ key: "showContributionRoom", label: "Contribution room", hint: "Track an annual contribution limit" },
];

interface AccountFieldConfiguratorProps {
	value: AccountFieldConfig;
	onChange: (next: AccountFieldConfig) => void;
}

/**
 * Lets the owner choose which fields the fully-customisable "Other" account type tracks.
 * All options start off - the user opts in.
 */
export function AccountFieldConfigurator({ value, onChange }: AccountFieldConfiguratorProps) {
	return (
		<div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
			{FIELD_OPTIONS.map((option) => (
				<div key={option.key} className="flex items-center justify-between gap-4 p-3">
					<div className="flex flex-col">
						<Label htmlFor={`field-${option.key}`} className="text-sm font-medium">
							{option.label}
						</Label>
						<span className="text-xs text-muted-foreground">{option.hint}</span>
					</div>
					<Switch
						id={`field-${option.key}`}
						checked={value[option.key] ?? false}
						onCheckedChange={(checked) => onChange({ ...value, [option.key]: checked })}
					/>
				</div>
			))}
		</div>
	);
}
