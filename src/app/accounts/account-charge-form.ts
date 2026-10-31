// Pure helpers for the account charge dialog and list (AccountChargesCard), kept free of React so
// they can be unit tested. Rates are typed as percentages and stored as fractions, like interest_rate.

import { formatShortDate, parseLocalDate } from "@/lib/date-utils";
import type { AccountCharge, AccountChargeInput, AccountTypeCode, ChargeFrequency } from "./types";

export const CHARGE_FREQUENCY_LABELS: Record<ChargeFrequency, string> = {
	monthly: "Every month",
	yearly: "Every year",
	cash_advance: "Per cash advance",
};

export const DEFAULT_CHARGE_NAMES: Record<ChargeFrequency, string> = {
	monthly: "Monthly account fee",
	yearly: "Annual fee",
	cash_advance: "Cash advance fee",
};

interface ChargeAccount {
	account_type: { code?: AccountTypeCode | null; class?: string | null; category?: string | null };
}

/** Cards and lines of credit can take cash advances; legacy rows fall back to their category. */
export function takesCashAdvances(account: ChargeAccount): boolean {
	const { code, category } = account.account_type;
	return code ? code === "credit_card" || code === "line_of_credit" : category === "credit";
}

/** A balance waiver only makes sense on an account that holds money. */
export function canWaiveCharge(account: ChargeAccount): boolean {
	return account.account_type.class !== "liability";
}

/** The frequencies this account offers, in label order. */
export function chargeFrequenciesFor(account: ChargeAccount): ChargeFrequency[] {
	const frequencies: ChargeFrequency[] = ["monthly", "yearly"];
	if (takesCashAdvances(account)) frequencies.push("cash_advance");
	return frequencies;
}

export interface ChargeFormValues {
	name: string;
	frequency: ChargeFrequency;
	amount: string;
	rate: string;
	next_charge_date: string;
	waive_min_balance: string;
}

const toField = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
const toAmount = (value: string) => {
	const parsed = parseFloat(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function toChargeValues(
	charge: AccountCharge | null,
	frequency: ChargeFrequency,
	today: string
): ChargeFormValues {
	if (!charge) {
		return {
			name: DEFAULT_CHARGE_NAMES[frequency],
			frequency,
			amount: "",
			rate: "",
			next_charge_date: today,
			waive_min_balance: "",
		};
	}
	return {
		name: charge.name,
		frequency: charge.frequency,
		amount: toField(charge.amount),
		rate: charge.rate ? String(Math.round(charge.rate * 1_000_000) / 10_000) : "",
		next_charge_date: charge.next_charge_date?.slice(0, 10) ?? today,
		waive_min_balance: toField(charge.waive_min_balance),
	};
}

/** What to save, or the first thing the user still has to fix. Fields the frequency does not use are cleared. */
export function toChargeInput(
	values: ChargeFormValues,
	account: ChargeAccount
): { input: AccountChargeInput; error?: undefined } | { input?: undefined; error: string } {
	const name = values.name.trim();
	if (!name) return { error: "Give the charge a name." };

	const amount = toAmount(values.amount);
	if (values.frequency === "cash_advance") {
		const rate = toAmount(values.rate);
		if (!amount && !rate) return { error: "Enter a fee amount, a percentage, or both." };
		return {
			input: {
				name,
				frequency: "cash_advance",
				amount,
				rate: rate ? Math.round(rate * 10_000) / 1_000_000 : null,
				next_charge_date: null,
				waive_min_balance: null,
			},
		};
	}

	if (!amount) return { error: "Enter the amount charged." };
	if (!values.next_charge_date) return { error: "Pick the date of the next charge." };
	const waive = values.frequency === "monthly" && canWaiveCharge(account) ? toAmount(values.waive_min_balance) : null;
	return {
		input: {
			name,
			frequency: values.frequency,
			amount,
			rate: null,
			next_charge_date: values.next_charge_date,
			waive_min_balance: waive,
		},
	};
}

/** The day of the month a charge posts on, kept so a charge on the 31st returns to the 31st. */
export function chargeDay(nextChargeDate: string): number {
	return parseLocalDate(nextChargeDate).getDate();
}

/** "$16.95 a month, next Nov 1", "5% (at least $3.50) per cash advance". */
export function describeCharge(charge: AccountChargeInput, money: (amount: number) => string): string {
	if (charge.frequency === "cash_advance") {
		const percent = charge.rate ? `${Math.round(charge.rate * 1_000_000) / 10_000}%` : null;
		const flat = charge.amount ? money(charge.amount) : null;
		const fee = percent && flat ? `${percent} (at least ${flat})` : (percent ?? flat);
		return `${fee} per cash advance`;
	}
	const period = charge.frequency === "monthly" ? "a month" : "a year";
	const next = charge.next_charge_date ? `, next ${formatShortDate(parseLocalDate(charge.next_charge_date))}` : "";
	return `${money(charge.amount ?? 0)} ${period}${next}`;
}

/** "Waived when the balance stays at or above $4,000 all month", or null without a waiver. */
export function describeWaiver(charge: AccountChargeInput, money: (amount: number) => string): string | null {
	if (charge.frequency !== "monthly" || !charge.waive_min_balance) return null;
	return `Waived when the balance stays at or above ${money(charge.waive_min_balance)} all month`;
}
