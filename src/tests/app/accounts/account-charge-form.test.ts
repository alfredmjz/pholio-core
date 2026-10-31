import { describe, expect, test } from "bun:test";
import {
	chargeDay,
	chargeFrequenciesFor,
	describeCharge,
	describeWaiver,
	toChargeInput,
	toChargeValues,
	type ChargeFormValues,
} from "@/app/accounts/account-charge-form";
import type { AccountCharge } from "@/app/accounts/types";

const chequing = { account_type: { code: "chequing" as const, class: "asset" } };
const card = { account_type: { code: "credit_card" as const, class: "liability" } };
const loan = { account_type: { code: "loan" as const, class: "liability" } };
const money = (amount: number) => `$${amount.toFixed(2)}`;

const values = (changes: Partial<ChargeFormValues>): ChargeFormValues => ({
	...toChargeValues(null, "monthly", "2026-11-01"),
	...changes,
});

describe("chargeFrequenciesFor", () => {
	test("cards and lines of credit add cash advances", () => {
		expect(chargeFrequenciesFor(card)).toEqual(["monthly", "yearly", "cash_advance"]);
		expect(chargeFrequenciesFor({ account_type: { code: "line_of_credit", class: "liability" } })).toContain(
			"cash_advance"
		);
	});

	test("other accounts get monthly and yearly", () => {
		expect(chargeFrequenciesFor(chequing)).toEqual(["monthly", "yearly"]);
		expect(chargeFrequenciesFor(loan)).toEqual(["monthly", "yearly"]);
	});

	test("a legacy credit row without a code still takes cash advances", () => {
		expect(chargeFrequenciesFor({ account_type: { code: null, class: "liability", category: "credit" } })).toContain(
			"cash_advance"
		);
	});
});

describe("toChargeInput", () => {
	test("a monthly fee with a waiver on chequing", () => {
		expect(toChargeInput(values({ amount: "16.95", waive_min_balance: "4000" }), chequing)).toEqual({
			input: {
				name: "Monthly account fee",
				frequency: "monthly",
				amount: 16.95,
				rate: null,
				next_charge_date: "2026-11-01",
				waive_min_balance: 4000,
			},
		});
	});

	test("a waiver is dropped on a liability and on a yearly fee", () => {
		expect(
			toChargeInput(values({ amount: "10", waive_min_balance: "4000" }), card).input?.waive_min_balance
		).toBeNull();
		expect(
			toChargeInput(values({ frequency: "yearly", amount: "120", waive_min_balance: "4000" }), chequing).input
				?.waive_min_balance
		).toBeNull();
	});

	test("a cash advance fee stores 5% as 0.05 and clears the date", () => {
		expect(toChargeInput(values({ frequency: "cash_advance", amount: "3.50", rate: "5" }), card)).toEqual({
			input: {
				name: "Monthly account fee",
				frequency: "cash_advance",
				amount: 3.5,
				rate: 0.05,
				next_charge_date: null,
				waive_min_balance: null,
			},
		});
	});

	test("a cash advance fee can be a percentage alone", () => {
		expect(toChargeInput(values({ frequency: "cash_advance", rate: "2.5" }), card).input).toMatchObject({
			amount: null,
			rate: 0.025,
		});
	});

	test("asks for what is missing", () => {
		expect(toChargeInput(values({ name: "  ", amount: "5" }), chequing).error).toBe("Give the charge a name.");
		expect(toChargeInput(values({ amount: "" }), chequing).error).toBe("Enter the amount charged.");
		expect(toChargeInput(values({ amount: "0" }), chequing).error).toBe("Enter the amount charged.");
		expect(toChargeInput(values({ amount: "5", next_charge_date: "" }), chequing).error).toBe(
			"Pick the date of the next charge."
		);
		expect(toChargeInput(values({ frequency: "cash_advance" }), card).error).toBe(
			"Enter a fee amount, a percentage, or both."
		);
	});
});

describe("toChargeValues", () => {
	test("shows a stored rate as a percentage", () => {
		const charge = {
			id: "c1",
			name: "Cash advance fee",
			frequency: "cash_advance",
			amount: 3.5,
			rate: 0.05,
			next_charge_date: null,
			waive_min_balance: null,
		} as AccountCharge;
		expect(toChargeValues(charge, "monthly", "2026-11-01")).toMatchObject({ rate: "5", amount: "3.5" });
	});
});

describe("chargeDay", () => {
	test("is the day of the month of the next charge", () => {
		expect(chargeDay("2026-10-31")).toBe(31);
		expect(chargeDay("2026-11-01")).toBe(1);
	});
});

describe("describeCharge", () => {
	const base = { name: "Fee", rate: null, next_charge_date: null, waive_min_balance: null };

	test("monthly and yearly fees show the amount, period and next date", () => {
		expect(
			describeCharge({ ...base, frequency: "monthly", amount: 16.95, next_charge_date: "2026-11-01" }, money)
		).toBe("$16.95 a month, next Nov 1");
		expect(describeCharge({ ...base, frequency: "yearly", amount: 120, next_charge_date: "2027-03-15" }, money)).toBe(
			"$120.00 a year, next Mar 15"
		);
	});

	test("cash advance fees show the percentage, minimum or both", () => {
		expect(describeCharge({ ...base, frequency: "cash_advance", amount: 3.5, rate: 0.05 }, money)).toBe(
			"5% (at least $3.50) per cash advance"
		);
		expect(describeCharge({ ...base, frequency: "cash_advance", amount: null, rate: 0.025 }, money)).toBe(
			"2.5% per cash advance"
		);
		expect(describeCharge({ ...base, frequency: "cash_advance", amount: 10, rate: null }, money)).toBe(
			"$10.00 per cash advance"
		);
	});

	test("the waiver is described for a monthly fee only", () => {
		expect(describeWaiver({ ...base, frequency: "monthly", amount: 16.95, waive_min_balance: 4000 }, money)).toBe(
			"Waived when the balance stays at or above $4000.00 all month"
		);
		expect(describeWaiver({ ...base, frequency: "monthly", amount: 16.95 }, money)).toBeNull();
	});
});
