"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createAccountCharge, updateAccountCharge } from "@/lib/actions/account-charge-actions";
import { getCurrencySymbol } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import {
	CHARGE_FREQUENCY_LABELS,
	DEFAULT_CHARGE_NAMES,
	canWaiveCharge,
	chargeFrequenciesFor,
	toChargeInput,
	toChargeValues,
	type ChargeFormValues,
} from "../../account-charge-form";
import type { AccountCharge, AccountWithType, ChargeFrequency } from "../../types";

interface AccountChargeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountWithType;
	charge: AccountCharge | null;
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
	onSuccess: () => void;
}

function MoneyField({
	id,
	label,
	value,
	onChange,
	placeholder,
	hint,
	decimals = 2,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	hint?: string;
	decimals?: number;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				inputMode="decimal"
				value={value}
				placeholder={placeholder}
				onChange={(event) => onChange(sanitizeDecimalInput(event.target.value, decimals))}
				className="h-10"
			/>
			{hint && <p className="type-body-xs text-muted-foreground">{hint}</p>}
		</div>
	);
}

/** Add or edit a fee the bank charges on this account: monthly, yearly or per cash advance. */
export function AccountChargeDialog({
	open,
	onOpenChange,
	account,
	charge,
	today,
	onSuccess,
}: AccountChargeDialogProps) {
	const [values, setValues] = useState<ChargeFormValues>(() => toChargeValues(charge, "monthly", today));
	const [saving, setSaving] = useState(false);
	const frequencies = chargeFrequenciesFor(account);
	const symbol = getCurrencySymbol();

	useEffect(() => {
		if (open) setValues(toChargeValues(charge, "monthly", today));
	}, [open, charge, today]);

	const change = (changes: Partial<ChargeFormValues>) => setValues((current) => ({ ...current, ...changes }));

	const changeFrequency = (frequency: ChargeFrequency) => {
		const keepsName = values.name.trim() && values.name !== DEFAULT_CHARGE_NAMES[values.frequency];
		change({ frequency, name: keepsName ? values.name : DEFAULT_CHARGE_NAMES[frequency] });
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const result = toChargeInput(values, account);
		if (result.error !== undefined) {
			toast.error(result.error);
			return;
		}

		setSaving(true);
		const saved = charge
			? await updateAccountCharge(charge.id, account.id, result.input)
			: await createAccountCharge(account.id, result.input);
		setSaving(false);

		if (saved) {
			toast.success(charge ? "Charge updated" : "Charge added");
			onOpenChange(false);
			onSuccess();
		} else {
			toast.error("Couldn't save the charge", { description: "Try again in a moment." });
		}
	};

	const isCashAdvance = values.frequency === "cash_advance";
	const showWaiver = values.frequency === "monthly" && canWaiveCharge(account);

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title={charge ? "Edit charge" : "Add charge"}
			description="Pholio adds this fee to the account when it is due."
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
				<div className="space-y-2">
					<Label id="charge-frequency-label">How often</Label>
					<ToggleGroup
						type="single"
						variant="segmented"
						aria-labelledby="charge-frequency-label"
						value={values.frequency}
						onValueChange={(next) => next && changeFrequency(next as ChargeFrequency)}
						className="w-full justify-start rounded-lg border border-border/60 bg-background p-1"
					>
						{frequencies.map((frequency) => (
							<ToggleGroupItem
								key={frequency}
								value={frequency}
								className="type-body-xs flex-1 px-3 py-1.5 data-[state=on]:ring-1 data-[state=on]:ring-ring"
							>
								{CHARGE_FREQUENCY_LABELS[frequency]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				<div className="space-y-2">
					<Label htmlFor="charge-name">Name</Label>
					<Input
						id="charge-name"
						value={values.name}
						maxLength={100}
						onChange={(event) => change({ name: event.target.value })}
						className="h-10"
					/>
				</div>

				{isCashAdvance ? (
					<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
						<MoneyField
							id="charge-rate"
							label="Fee (%)"
							value={values.rate}
							onChange={(rate) => change({ rate })}
							placeholder="5.00"
							hint="Share of each cash advance."
							decimals={4}
						/>
						<MoneyField
							id="charge-amount"
							label={`Minimum fee (${symbol})`}
							value={values.amount}
							onChange={(amount) => change({ amount })}
							placeholder="3.50"
							hint="Charged when the percentage comes to less."
						/>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
						<MoneyField
							id="charge-amount"
							label={`Amount (${symbol})`}
							value={values.amount}
							onChange={(amount) => change({ amount })}
							placeholder={values.frequency === "monthly" ? "16.95" : "120.00"}
						/>
						<div className="space-y-2">
							<Label htmlFor="charge-next">Next charge</Label>
							<DatePicker
								id="charge-next"
								value={values.next_charge_date}
								onChange={(next_charge_date) => change({ next_charge_date })}
							/>
						</div>
					</div>
				)}

				{showWaiver && (
					<MoneyField
						id="charge-waive"
						label={`Waived above (${symbol}), optional`}
						value={values.waive_min_balance}
						onChange={(waive_min_balance) => change({ waive_min_balance })}
						placeholder="4000"
						hint="No fee for a month the balance never drops below this amount."
					/>
				)}

				<DialogFooter className="pt-2">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
						<CancelShortcut />
					</Button>
					<Button type="submit" disabled={saving} className="gap-2">
						{saving && <Loader2 className="h-4 w-4 animate-spin" />}
						{charge ? "Save changes" : "Add charge"}
						<SubmitShortcut />
					</Button>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
