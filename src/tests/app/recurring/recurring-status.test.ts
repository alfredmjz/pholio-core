import { describe, expect, test } from "bun:test";
import { enrichRecurringExpenses } from "@/app/recurring/recurring-status";
import type { RecurringExpense } from "@/app/recurring/recurring-types";

const NOW = new Date(2026, 5, 15);

function expense(overrides: Partial<RecurringExpense>): RecurringExpense {
	return {
		id: "r1",
		user_id: "u1",
		name: "Netflix",
		amount: 16,
		currency: "CAD",
		billing_period: "monthly",
		next_due_date: "2026-06-20",
		category: "subscription",
		budget_category: null,
		account_id: null,
		to_account_id: null,
		is_active: true,
		service_provider: null,
		meta_data: {},
		created_at: null,
		updated_at: null,
		...overrides,
	};
}

describe("enrichRecurringExpenses", () => {
	test("marks an unpaid item due later this month as upcoming", () => {
		const [result] = enrichRecurringExpenses([expense({})], [], [], NOW);
		expect(result.status).toBe("upcoming");
		expect(result.paid_amount).toBe(0);
	});

	test("marks an unpaid item past its due date as overdue", () => {
		const [result] = enrichRecurringExpenses([expense({ next_due_date: "2026-06-10" })], [], [], NOW);
		expect(result.status).toBe("overdue");
	});

	test("counts a linked payment of the full amount as paid", () => {
		const payment = {
			name: "Netflix",
			amount: -16,
			transaction_date: "2026-06-10",
			recurring_expense_id: "r1",
			covers_due_date: "2026-06-10",
		};
		const [result] = enrichRecurringExpenses([expense({ next_due_date: "2026-07-10" })], [payment], [], NOW);
		expect(result.status).toBe("paid");
		expect(result.paid_amount).toBe(16);
	});

	test("a manual debt payment named Payment does not pay a recurring item with payment in its name", () => {
		const item = expense({ id: "loc", name: "LOC payment", category: "transfer", next_due_date: "2026-06-20" });
		const manualPayment = {
			name: "Payment",
			amount: 100,
			transaction_date: "2026-06-10",
			recurring_expense_id: null,
			source: "transfer",
		};
		const [result] = enrichRecurringExpenses([item], [manualPayment], [], NOW);
		expect([result.paid_count, result.occurrences_count, result.status]).toEqual([0, 1, "upcoming"]);
	});

	test("an older unlinked bill row still pays its item by name", () => {
		const row = {
			name: "Netflix",
			amount: 16,
			transaction_date: "2026-06-10",
			recurring_expense_id: null,
			source: "manual",
		};
		const [result] = enrichRecurringExpenses([expense({})], [row], [], NOW);
		expect(result.paid_count).toBe(1);
	});

	test("returns nothing for no items", () => {
		expect(enrichRecurringExpenses([], [], [], NOW)).toEqual([]);
	});
});
