import { describe, expect, test } from "bun:test";
import { accountBeforeSavedRow, getLinkedAccountIds } from "@/app/allocations/utils/transfer-accounts";
import type { Transaction } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";

const account = (id: string, balance: number, accountClass: "asset" | "liability") =>
	({ id, current_balance: balance, account_type: { class: accountClass } }) as unknown as AccountWithType;

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

describe("accountBeforeSavedRow", () => {
	test("adds back an expense already taken from the account", () => {
		// Chequing had 100; the saved $60 payment left 40.
		const payment = row({ amount: -60, linked_account_transaction: { id: "leg", account_id: "chequing", amount: -60 } });
		expect(accountBeforeSavedRow(account("chequing", 40, "asset"), payment)?.current_balance).toBe(100);
	});

	test("takes back a charge already added to a card's debt", () => {
		const charge = row({ amount: -15, linked_account_transaction: { id: "leg", account_id: "visa", amount: 15 } });
		expect(accountBeforeSavedRow(account("visa", 415, "liability"), charge)?.current_balance).toBe(400);
	});

	test("leaves another account alone", () => {
		const payment = row({ linked_account_transaction: { id: "leg", account_id: "chequing", amount: -60 } });
		const savings = account("savings", 500, "asset");
		expect(accountBeforeSavedRow(savings, payment)).toBe(savings);
	});

	test("undoes both legs of a transfer", () => {
		// $300 from chequing (1000 -> 700) to the card (debt 900 -> 600).
		const transfer = row({
			source: "transfer",
			amount: 300,
			linked_account_transaction: { id: "from-leg", account_id: "chequing", amount: -300 },
			linked_account_transactions: [
				{ id: "from-leg", account_id: "chequing" },
				{ id: "to-leg", account_id: "visa" },
			],
		});
		expect(accountBeforeSavedRow(account("chequing", 700, "asset"), transfer)?.current_balance).toBe(1000);
		expect(accountBeforeSavedRow(account("visa", 600, "liability"), transfer)?.current_balance).toBe(900);
	});

	test("a new transaction leaves the account as it is", () => {
		const chequing = account("chequing", 40, "asset");
		expect(accountBeforeSavedRow(chequing, null)).toBe(chequing);
	});
});
