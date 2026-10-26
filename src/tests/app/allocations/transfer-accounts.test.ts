import { describe, expect, test } from "bun:test";
import { getLinkedAccountIds } from "@/app/allocations/utils/transfer-accounts";
import type { Transaction } from "@/app/allocations/types";

const row = (overrides: Partial<Transaction>): Transaction => ({
	id: "tx",
	user_id: "user",
	name: "Row",
	amount: -10,
	transaction_date: "2026-10-05",
	source: "manual",
	created_at: "2026-10-05T00:00:00Z",
	updated_at: "2026-10-05T00:00:00Z",
	...overrides,
});

describe("getLinkedAccountIds", () => {
	test("a budget-only row has no accounts", () => {
		expect(getLinkedAccountIds(row({}))).toEqual([]);
	});

	test("an expense lists its one account", () => {
		expect(
			getLinkedAccountIds(row({ linked_account_transaction: { id: "leg", account_id: "chequing", amount: -10 } }))
		).toEqual(["chequing"]);
	});

	test("a transfer lists the source, then the destination", () => {
		const transfer = row({
			source: "transfer",
			amount: 300,
			linked_account_transaction: { id: "from-leg", account_id: "chequing", amount: -300 },
			linked_account_transactions: [
				{ id: "from-leg", account_id: "chequing" },
				{ id: "to-leg", account_id: "visa" },
			],
		});
		expect(getLinkedAccountIds(transfer)).toEqual(["chequing", "visa"]);
	});

	test("a transfer whose destination was deleted lists only the source", () => {
		const transfer = row({
			source: "transfer",
			linked_account_transaction: { id: "from-leg", account_id: "chequing", amount: -300 },
			linked_account_transactions: [
				{ id: "from-leg", account_id: "chequing" },
				{ id: "to-leg", account_id: null },
			],
		});
		expect(getLinkedAccountIds(transfer)).toEqual(["chequing"]);
	});
});
