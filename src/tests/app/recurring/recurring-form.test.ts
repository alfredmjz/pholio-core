import { describe, expect, test } from "bun:test";
import {
	emptyRecurringForm,
	expenseToForm,
	formToPayload,
	NO_ACCOUNT,
	validateRecurringForm,
} from "@/app/recurring/components/recurring-form";
import type { RecurringExpense } from "@/app/recurring/actions";

const expense = (overrides: Partial<RecurringExpense> = {}) =>
	({
		id: "e1",
		name: "Rent",
		amount: 1200,
		billing_period: "monthly",
		next_due_date: "2026-12-01",
		category: "bill",
		budget_category: null,
		account_id: null,
		to_account_id: null,
		meta_data: {},
		...overrides,
	}) as RecurringExpense;

const form = (overrides = {}) => ({
	...emptyRecurringForm(new Date(2026, 10, 14)),
	name: "Rent",
	amount: "10",
	...overrides,
});

describe("validateRecurringForm", () => {
	test("accepts a plain amount and reports amount and frequency as numbers", () => {
		expect(validateRecurringForm(form({ amount: "9.99", frequency_value: "3" }))).toEqual({
			ok: true,
			amount: 9.99,
			frequencyValue: 3,
		});
	});

	test("requires a name and an amount", () => {
		expect(validateRecurringForm(form({ name: "  " }))).toMatchObject({ ok: false, title: "Name is required" });
		expect(validateRecurringForm(form({ amount: "" }))).toMatchObject({ ok: false, title: "Amount is required" });
	});

	test("pins today's amount rules: .5, 9.999 and 0 are rejected", () => {
		expect(validateRecurringForm(form({ amount: ".5" }))).toMatchObject({ ok: false, title: "Invalid amount" });
		expect(validateRecurringForm(form({ amount: "9.999" }))).toMatchObject({ ok: false, title: "Invalid amount" });
		expect(validateRecurringForm(form({ amount: "0" }))).toMatchObject({
			ok: false,
			description: "Amount must be greater than zero.",
		});
		expect(validateRecurringForm(form({ amount: "5." }))).toMatchObject({ ok: false });
	});

	test("frequency must be a whole number of at least 1", () => {
		expect(validateRecurringForm(form({ frequency_value: "" }))).toMatchObject({
			ok: false,
			title: "Invalid frequency",
		});
		expect(validateRecurringForm(form({ frequency_value: "0" }))).toMatchObject({
			ok: false,
			title: "Invalid frequency",
		});
	});

	test("a transfer needs two different accounts", () => {
		const transfer = { category: "transfer", account_id: "a", to_account_id: "" };
		expect(validateRecurringForm(form(transfer))).toMatchObject({ ok: false, title: "Choose two accounts" });
		expect(validateRecurringForm(form({ ...transfer, to_account_id: "a" }))).toMatchObject({
			ok: false,
			description: "The two accounts must be different.",
		});
		expect(validateRecurringForm(form({ ...transfer, to_account_id: "b" })).ok).toBe(true);
	});
});

describe("formToPayload", () => {
	test("maps the sentinels to null and builds the period", () => {
		const payload = formToPayload(form({ frequency_unit: "weeks", next_due_date: new Date(2026, 11, 1) }), {
			amount: 10,
			frequencyValue: 2,
		});
		expect(payload).toEqual({
			name: "Rent",
			amount: 10,
			billing_period: "2:weeks",
			next_due_date: "2026-12-01",
			category: "subscription",
			budget_category: null,
			account_id: null,
			to_account_id: null,
		});
	});

	test("keeps a chosen budget category and account", () => {
		const payload = formToPayload(form({ budget_category: "Housing", account_id: "acc" }), {
			amount: 1,
			frequencyValue: 1,
		});
		expect(payload).toMatchObject({ budget_category: "Housing", account_id: "acc" });
	});

	test("a transfer has no budget category and keeps its destination", () => {
		const payload = formToPayload(
			form({ category: "transfer", budget_category: "Housing", account_id: "a", to_account_id: "b" }),
			{ amount: 1, frequencyValue: 1 }
		);
		expect(payload).toMatchObject({ budget_category: null, account_id: "a", to_account_id: "b" });
	});
});

describe("expenseToForm", () => {
	test("legacy periods round-trip to the same period", () => {
		const cases: Array<[string, string, string]> = [
			["monthly", "1", "months"],
			["yearly", "1", "years"],
			["weekly", "1", "weeks"],
			["biweekly", "2", "weeks"],
			["3:months", "3", "months"],
		];
		for (const [stored, value, unit] of cases) {
			const values = expenseToForm(expense({ billing_period: stored }));
			expect([values.frequency_value, values.frequency_unit]).toEqual([value, unit]);
		}
	});

	test("daily reads as days", () => {
		expect(expenseToForm(expense({ billing_period: "daily" })).frequency_unit).toBe("days");
	});

	test("defaults for empty fields", () => {
		const values = expenseToForm(expense());
		expect(values).toMatchObject({
			budget_category: "__default__",
			account_id: NO_ACCOUNT,
			to_account_id: "",
			is_automated: true,
		});
		expect(values.next_due_date).toEqual(new Date(2026, 11, 1));
	});

	test("a transfer without a source starts empty, and is_automated false is kept", () => {
		const values = expenseToForm(expense({ category: "transfer", meta_data: { is_automated: false } }));
		expect(values.account_id).toBe("");
		expect(values.is_automated).toBe(false);
	});

	test("reactivating starts today", () => {
		const now = new Date(2026, 10, 14);
		expect(expenseToForm(expense(), { reactivating: true, now }).next_due_date).toBe(now);
	});
});
