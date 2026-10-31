"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getCurrencySymbol } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import type { FieldVisibility } from "../field-visibility";
import type { FeeTermsFormValues } from "../fee-terms-form";

interface FeeTermsFieldsProps {
	values: FeeTermsFormValues;
	onChange: (changes: Partial<FeeTermsFormValues>) => void;
	visibility: Pick<FieldVisibility, "showOverdraft" | "showOverLimitFee">;
}

function FeeInput({
	id,
	label,
	value,
	onChange,
	placeholder,
	hint,
}: {
	id: keyof FeeTermsFormValues;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	hint?: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				inputMode="decimal"
				value={value}
				placeholder={placeholder}
				onChange={(event) => onChange(sanitizeDecimalInput(event.target.value, 2))}
				className="h-10"
			/>
			{hint && <p className="type-body-xs text-muted-foreground">{hint}</p>}
		</div>
	);
}

/**
 * What the bank charges when the balance goes below zero or the debt goes past the credit limit.
 * Pholio posts the fee with the payment that causes it. All optional.
 */
export function FeeTermsFields({ values, onChange, visibility }: FeeTermsFieldsProps) {
	if (!visibility.showOverdraft && !visibility.showOverLimitFee) return null;
	const symbol = getCurrencySymbol();

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-0.5">
				<p className="type-label text-muted-foreground">Bank fees</p>
				<p className="type-body-xs text-muted-foreground">
					Optional. Pholio adds the fee to this account when a payment causes it.
				</p>
			</div>

			{visibility.showOverdraft && (
				<>
					<div className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
						<div className="space-y-0.5">
							<Label htmlFor="overdraft_protection">Overdraft protection</Label>
							<p className="type-body-sm text-muted-foreground">The bank lets this account go below zero.</p>
						</div>
						<Switch
							id="overdraft_protection"
							checked={values.overdraft_protection}
							onCheckedChange={(checked) => onChange({ overdraft_protection: checked })}
						/>
					</div>
					<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
						{values.overdraft_protection && (
							<>
								<FeeInput
									id="overdraft_limit"
									label={`Overdraft limit (${symbol})`}
									value={values.overdraft_limit}
									onChange={(value) => onChange({ overdraft_limit: value })}
									placeholder="500"
								/>
								<FeeInput
									id="overdraft_fee"
									label={`Overdraft fee (${symbol})`}
									value={values.overdraft_fee}
									onChange={(value) => onChange({ overdraft_fee: value })}
									placeholder="5.00"
									hint="Per payment while below zero."
								/>
								<FeeInput
									id="overdraft_interest_rate"
									label="Overdraft interest (%)"
									value={values.overdraft_interest_rate}
									onChange={(value) => onChange({ overdraft_interest_rate: value })}
									placeholder="21.00"
									hint="Charged monthly on the overdrawn amount."
								/>
							</>
						)}
						<FeeInput
							id="nsf_fee"
							label={`NSF fee (${symbol})`}
							value={values.nsf_fee}
							onChange={(value) => onChange({ nsf_fee: value })}
							placeholder="48.00"
							hint={
								values.overdraft_protection
									? "Per payment past the overdraft limit."
									: "Per payment that takes the balance below zero."
							}
						/>
					</div>
				</>
			)}

			{visibility.showOverLimitFee && (
				<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
					<FeeInput
						id="over_limit_fee"
						label={`Over-limit fee (${symbol})`}
						value={values.over_limit_fee}
						onChange={(value) => onChange({ over_limit_fee: value })}
						placeholder="29.00"
						hint="Per charge that goes past the credit limit."
					/>
				</div>
			)}
		</div>
	);
}
