"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AccountClass, AccountFieldConfig } from "../types";

interface FieldOption {
	key: keyof AccountFieldConfig;
	label: string;
	hint: string;
	/** Only offered to accounts of this class. */
	class?: AccountClass;
}

const FIELD_OPTIONS: FieldOption[] = [
	{ key: "showTargetGoal", label: "Target goal", hint: "Track a savings goal amount" },
	{ key: "showCreditLimit", label: "Credit limit", hint: "Total credit available" },
	{ key: "showOriginalAmount", label: "Original amount", hint: "Initial principal / balance" },
	{ key: "showInterestRate", label: "Interest rate", hint: "APR / APY %" },
	{ key: "showLoanTerm", label: "Loan term", hint: "Term in months" },
	{ key: "showDueDate", label: "Payment due date", hint: "Day of the month" },
	{ key: "showContributionRoom", label: "Contribution room", hint: "Track an annual contribution limit" },
	{
		key: "showOverdraft",
		label: "Overdraft and NSF fees",
		hint: "Fees when the balance goes below zero",
		class: "asset",
	},
	{
		key: "showOverLimitFee",
		label: "Over-limit fee",
		hint: "Fee when the debt goes past the limit",
		class: "liability",
	},
];

interface AccountFieldConfiguratorProps {
	value: AccountFieldConfig;
	onChange: (next: AccountFieldConfig) => void;
	accountClass?: AccountClass;
}

/**
 * Lets the owner choose which fields the fully-customisable "Other" account type tracks.
 * All options start off - the user opts in.
 */
export function AccountFieldConfigurator({ value, onChange, accountClass }: AccountFieldConfiguratorProps) {
	const options = FIELD_OPTIONS.filter((option) => !option.class || !accountClass || option.class === accountClass);
	return (
		<div className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
			{options.map((option) => (
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
