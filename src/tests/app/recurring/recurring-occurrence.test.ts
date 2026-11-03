import { describe, expect, test } from "bun:test";
import {
	canPostTransfer,
	isRecurringTransfer,
	monthlyTotalsByKind,
	recurringOccurrenceRow,
} from "@/app/recurring/recurring-occurrence";

const occurrence = {
	userId: "user-1",
	transactionDate: "2026-11-01",
	coversDueDate: "2026-11-01",
	categoryId: "cat-bills",
	notes: "Auto-created",
};

describe("recurringOccurrenceRow", () => {
	test("a bill is a negative recurring row in its budget category", () => {
		const row = recurringOccurrenceRow({ id: "rent", name: "Rent", amount: 1200, category: "bill" }, occurrence);
		expect(row).toEqual({
			user_id: "user-1",
			name: "Rent",
			amount: -1200,
			transaction_date: "2026-11-01",
			covers_due_date: "2026-11-01",
			category_id: "cat-bills",
			source: "recurring",
			recurring_expense_id: "rent",
			notes: "Auto-created",
		});
	});

	test("a transfer is a positive transfer row with no budget category", () => {
		const row = recurringOccurrenceRow(
			{ id: "tfsa", name: "TFSA contribution", amount: "500.00", category: "transfer" },
			occurrence
		);
		expect(row.amount).toBe(500);
		expect(row.source).toBe("transfer");
		expect(row.category_id).toBeNull();
		expect(row.recurring_expense_id).toBe("tfsa");
		expect(row.covers_due_date).toBe("2026-11-01");
	});

	test("a negative stored amount still posts its size", () => {
		expect(recurringOccurrenceRow({ id: "x", name: "x", amount: -75.5, category: "transfer" }, occurrence).amount).toBe(
			75.5
		);
		expect(
			recurringOccurrenceRow({ id: "x", name: "x", amount: -75.5, category: "subscription" }, occurrence).amount
		).toBe(-75.5);
	});
});

describe("isRecurringTransfer", () => {
	test("only the transfer category is a transfer", () => {
		expect(isRecurringTransfer({ category: "transfer" })).toBe(true);
		expect(isRecurringTransfer({ category: "bill" })).toBe(false);
		expect(isRecurringTransfer({ category: "subscription" })).toBe(false);
	});
});

describe("canPostTransfer", () => {
	const active = new Set(["chequing", "tfsa"]);

	test("two different active accounts can post", () => {
		expect(canPostTransfer({ account_id: "chequing", to_account_id: "tfsa" }, active)).toBe(true);
	});

	test("a missing account cannot post", () => {
		expect(canPostTransfer({ account_id: "chequing", to_account_id: null }, active)).toBe(false);
		expect(canPostTransfer({ account_id: null, to_account_id: "tfsa" }, active)).toBe(false);
	});

	test("the same account on both ends cannot post", () => {
		expect(canPostTransfer({ account_id: "tfsa", to_account_id: "tfsa" }, active)).toBe(false);
	});

	test("an archived account cannot post", () => {
		expect(canPostTransfer({ account_id: "chequing", to_account_id: "old-savings" }, active)).toBe(false);
	});
});

describe("monthlyTotalsByKind", () => {
	// Rent 1200/month, Netflix 15/month, a 120 yearly fee (10/month), a 500/month TFSA transfer,
	// a 100 every-2-weeks transfer (100 * 52 / 12 / 2 = 216.67/month) and a paused 50 subscription.
	const items = [
		{ amount: 1200, billing_period: "1:months", category: "bill" },
		{ amount: 15, billing_period: "monthly", category: "subscription" },
		{ amount: 120, billing_period: "1:years", category: "bill" },
		{ amount: 500, billing_period: "1:months", category: "transfer" },
		{ amount: 100, billing_period: "2:weeks", category: "transfer" },
		{ amount: 50, billing_period: "1:months", category: "subscription", is_active: false },
	];

	test("bills, subscriptions and transfers are totalled apart", () => {
		const totals = monthlyTotalsByKind(items);
		expect(totals.bill).toBeCloseTo(1210, 2);
		expect(totals.subscription).toBeCloseTo(15, 2);
		expect(totals.transfer).toBeCloseTo(500 + 216.6667, 2);
	});

	test("spending leaves out transfers and paused items", () => {
		expect(monthlyTotalsByKind(items).spending).toBeCloseTo(1225, 2);
	});
});
