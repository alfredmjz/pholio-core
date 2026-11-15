import { describe, expect, test } from "bun:test";
import {
	compareTransactions,
	filterAndSortTransactions,
	resolveAccountLabel,
	type LedgerQuery,
} from "@/app/allocations/components/ledger-query";
import type { Transaction } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";
import { makeAccount } from "../../support/contribution-fixtures";

const chequing = makeAccount({ id: "chq", balance: 100 });
const savings = makeAccount({ id: "sav", balance: 100 });
const accounts: AccountWithType[] = [chequing, savings];

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

const baseQuery: LedgerQuery = {
	searchQuery: "",
	categoryFilter: "all",
	typeFilter: null,
	minAmount: "",
	maxAmount: "",
	sorts: [{ field: "date", direction: "desc" }],
};

const names = (list: Transaction[]) => list.map((t) => t.id);

describe("resolveAccountLabel", () => {
	test("an untagged row shows an em dash", () => {
		expect(resolveAccountLabel(row({}), accounts)).toBe("—");
	});

	test("a row reads its account from the linked leg", () => {
		const tagged = row({ linked_account_transaction: { id: "leg", account_id: "chq", amount: -10 } });
		expect(resolveAccountLabel(tagged, accounts)).toBe(resolveAccountLabel(row({ account_id: "chq" }), accounts));
		expect(resolveAccountLabel(tagged, accounts)).not.toBe("—");
	});

	test("a transfer shows source to destination, with External for an unknown side", () => {
		const transfer = row({
			source: "transfer",
			linked_account_transaction: { id: "from", account_id: "chq", amount: -10 },
			linked_account_transactions: [
				{ id: "from", account_id: "chq" },
				{ id: "to", account_id: "gone" },
			],
		});
		expect(resolveAccountLabel(transfer, accounts)).toMatch(/ → External$/);
	});
});

describe("compareTransactions", () => {
	test("amount compares by size, ignoring sign", () => {
		expect(compareTransactions(row({ amount: -50 }), row({ amount: 20 }), "amount", accounts)).toBe(30);
	});

	test("category treats a missing name as empty", () => {
		expect(compareTransactions(row({}), row({ category_name: "Food" }), "category", accounts)).toBeLessThan(0);
	});

	test("date compares by time", () => {
		expect(
			compareTransactions(
				row({ transaction_date: "2026-10-01" }),
				row({ transaction_date: "2026-10-09" }),
				"date",
				accounts
			)
		).toBeLessThan(0);
	});
});

describe("filterAndSortTransactions", () => {
	const list = [
		row({
			id: "a",
			name: "Groceries",
			category_id: "food",
			category_name: "Food",
			amount: -80,
			transaction_date: "2026-10-02",
		}),
		row({
			id: "b",
			name: "Rent",
			category_id: "home",
			category_name: "Housing",
			amount: -1000,
			transaction_date: "2026-10-01",
			notes: "october",
		}),
		row({ id: "c", name: "Paycheck", amount: 2500, transaction_date: "2026-10-15" }),
		row({
			id: "d",
			name: "Coffee",
			category_id: "food",
			category_name: "Food",
			amount: -5,
			transaction_date: "2026-10-02",
		}),
	];

	test("sorts newest first by default, with ties kept newest-first", () => {
		expect(names(filterAndSortTransactions(list, accounts, baseQuery))).toEqual(["c", "a", "d", "b"]);
	});

	test("search matches name, category and notes, case-insensitively", () => {
		expect(names(filterAndSortTransactions(list, accounts, { ...baseQuery, searchQuery: "FOOD" }))).toEqual(["a", "d"]);
		expect(names(filterAndSortTransactions(list, accounts, { ...baseQuery, searchQuery: "octob" }))).toEqual(["b"]);
		expect(names(filterAndSortTransactions(list, accounts, { ...baseQuery, searchQuery: "rent" }))).toEqual(["b"]);
	});

	test("category filter keeps only that category", () => {
		expect(names(filterAndSortTransactions(list, accounts, { ...baseQuery, categoryFilter: "home" }))).toEqual(["b"]);
	});

	test("amount range uses the absolute amount and ignores unparsable bounds", () => {
		expect(
			names(filterAndSortTransactions(list, accounts, { ...baseQuery, minAmount: "50", maxAmount: "1000" }))
		).toEqual(["a", "b"]);
		expect(names(filterAndSortTransactions(list, accounts, { ...baseQuery, minAmount: "abc" }))).toHaveLength(4);
	});

	test("type filter uses the inferred type", () => {
		const recurring = row({ id: "r", recurring_expense_id: "rec-1" });
		const result = filterAndSortTransactions([...list, recurring], accounts, { ...baseQuery, typeFilter: "recurring" });
		expect(names(result)).toEqual(["r", "b"]); // "Rent" also reads as recurring by name
	});

	test("multiple sorts apply in order", () => {
		const sorted = filterAndSortTransactions(list, accounts, {
			...baseQuery,
			sorts: [
				{ field: "category", direction: "asc" },
				{ field: "amount", direction: "desc" },
			],
		});
		expect(names(sorted)).toEqual(["c", "a", "d", "b"]);
	});

	test("does not change the input list", () => {
		const copy = [...list];
		filterAndSortTransactions(list, accounts, { ...baseQuery, sorts: [{ field: "name", direction: "asc" }] });
		expect(list).toEqual(copy);
	});
});
