import { describe, expect, test } from "bun:test";
import { noneToNull, transactionCapCheck } from "@/components/dialogs/transaction-cap-check";
import { accountBeforeSavedRow } from "@/app/allocations/utils/transfer-accounts";
import { checkTransactionCaps } from "@/lib/account-validation-utils";
import type { Transaction } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";
import { makeAccount } from "../../support/contribution-fixtures";

const chequing = makeAccount({ id: "chq", balance: 100 });
const savings = makeAccount({ id: "sav", balance: 500 });
const card = makeAccount({ id: "card", accountClass: "liability", balance: 300, creditLimit: 1000 });
const accounts: AccountWithType[] = [chequing, savings, card];

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

// The inline logic each dialog ran before the helper, kept as the oracle.
const unifiedBefore = (p: {
	type: "income" | "expense" | "transfer";
	amount: string;
	accountId: string;
	fromId: string;
	toId: string;
	transactionType: string;
}) =>
	p.amount && parseFloat(p.amount) > 0
		? checkTransactionCaps({
				intent: p.type,
				amount: parseFloat(p.amount),
				account: p.type === "transfer" ? null : accounts.find((a) => a.id === p.accountId),
				fromAccount: p.type === "transfer" ? accounts.find((a) => a.id === p.fromId) : null,
				toAccount: p.type === "transfer" ? accounts.find((a) => a.id === p.toId) : null,
				transactionType: p.transactionType,
			})
		: { isValid: true, violations: [] };

const allocationsBefore = (p: {
	type: "income" | "expense" | "transfer";
	amount: string;
	accountId: string;
	fromId: string;
	toId: string;
	transaction?: Transaction | null;
}) => {
	const find = (id: string) =>
		accountBeforeSavedRow(
			accounts.find((a) => a.id === id),
			p.transaction
		);
	return p.amount && parseFloat(p.amount) > 0 && !p.transaction?.recurring_expense_id
		? checkTransactionCaps({
				intent: p.type,
				amount: parseFloat(p.amount),
				account: p.type === "transfer" ? null : find(p.accountId),
				fromAccount: p.type === "transfer" ? find(p.fromId) : null,
				toAccount: p.type === "transfer" ? find(p.toId) : null,
			})
		: { isValid: true, violations: [] };
};

describe("noneToNull", () => {
	test("maps the none sentinel and empty values to null", () => {
		expect(noneToNull("none")).toBeNull();
		expect(noneToNull("")).toBeNull();
		expect(noneToNull(null)).toBeNull();
		expect(noneToNull(undefined)).toBeNull();
		expect(noneToNull("chq")).toBe("chq");
	});
});

describe("Unified dialog inputs", () => {
	test("an expense over the available balance is blocked at the balance", () => {
		const result = transactionCapCheck({
			type: "expense",
			amount: 150,
			accountId: "chq",
			accounts,
			transactionType: "withdrawal",
		});
		expect(result.isValid).toBe(false);
		expect(result.violations[0]).toMatchObject({ field: "accountId", maxAllowed: 100, overridable: false });
		expect(result).toEqual(
			unifiedBefore({
				type: "expense",
				amount: "150",
				accountId: "chq",
				fromId: "none",
				toId: "none",
				transactionType: "withdrawal",
			})
		);
	});

	test("a payment over the debt is overridable", () => {
		const result = transactionCapCheck({
			type: "income",
			amount: 400,
			accountId: "card",
			accounts,
			transactionType: "payment",
		});
		expect(result.violations[0]).toMatchObject({ field: "accountId", maxAllowed: 300, overridable: true });
		expect(result).toEqual(
			unifiedBefore({
				type: "income",
				amount: "400",
				accountId: "card",
				fromId: "none",
				toId: "none",
				transactionType: "payment",
			})
		);
	});

	test("a transfer checks the source and destination, not the account field", () => {
		const result = transactionCapCheck({
			type: "transfer",
			amount: 150,
			accountId: "savings-ignored",
			fromId: "chq",
			toId: "card",
			accounts,
			transactionType: "deposit",
		});
		expect(result.violations.map((v) => v.field)).toEqual(["fromAccountId"]);
		expect(result).toEqual(
			unifiedBefore({
				type: "transfer",
				amount: "150",
				accountId: "none",
				fromId: "chq",
				toId: "card",
				transactionType: "deposit",
			})
		);
	});

	test("none selections and empty amounts pass", () => {
		expect(transactionCapCheck({ type: "transfer", amount: 50, fromId: "none", toId: "none", accounts }).isValid).toBe(
			true
		);
		expect(transactionCapCheck({ type: "expense", amount: 0, accountId: "chq", accounts })).toEqual({
			isValid: true,
			violations: [],
		});
		expect(transactionCapCheck({ type: "expense", amount: NaN, accountId: "chq", accounts }).isValid).toBe(true);
	});
});

describe("Allocations dialog inputs", () => {
	test("a new transfer is capped on fromAccountId, with no transaction type", () => {
		const result = transactionCapCheck({ type: "transfer", amount: 150, fromId: "chq", toId: "sav", accounts });
		expect(result.violations[0]).toMatchObject({ field: "fromAccountId", maxAllowed: 100 });
		expect(result).toEqual(
			allocationsBefore({ type: "transfer", amount: "150", accountId: "chq", fromId: "chq", toId: "sav" })
		);
	});

	test("editing an expense adds back the row's own amount", () => {
		const saved = row({
			amount: -60,
			linked_account_transaction: { id: "leg", account_id: "chq", amount: -60 },
		});
		const valid = transactionCapCheck({ type: "expense", amount: 150, accountId: "chq", accounts, savedRow: saved });
		expect(valid.isValid).toBe(true);
		expect(valid).toEqual(
			allocationsBefore({
				type: "expense",
				amount: "150",
				accountId: "chq",
				fromId: "chq",
				toId: "none",
				transaction: saved,
			})
		);
		const tooMuch = transactionCapCheck({ type: "expense", amount: 170, accountId: "chq", accounts, savedRow: saved });
		expect(tooMuch.violations[0]).toMatchObject({ maxAllowed: 160 });
	});

	test("editing a transfer adds back the source leg and removes the destination leg", () => {
		const saved = row({
			source: "transfer",
			amount: 300,
			linked_account_transaction: { id: "from-leg", account_id: "sav", amount: -300 },
			linked_account_transactions: [
				{ id: "from-leg", account_id: "sav" },
				{ id: "to-leg", account_id: "chq" },
			],
		});
		const result = transactionCapCheck({
			type: "transfer",
			amount: 700,
			fromId: "sav",
			toId: "chq",
			accounts,
			savedRow: saved,
		});
		expect(result.isValid).toBe(true);
		expect(result).toEqual(
			allocationsBefore({
				type: "transfer",
				amount: "700",
				accountId: "sav",
				fromId: "sav",
				toId: "chq",
				transaction: saved,
			})
		);
	});

	test("a recurring row is never capped", () => {
		const recurring = row({ recurring_expense_id: "rec-1" });
		const result = transactionCapCheck({
			type: "expense",
			amount: 9999,
			accountId: "chq",
			accounts,
			savedRow: recurring,
		});
		expect(result).toEqual({ isValid: true, violations: [] });
		expect(result).toEqual(
			allocationsBefore({
				type: "expense",
				amount: "9999",
				accountId: "chq",
				fromId: "chq",
				toId: "none",
				transaction: recurring,
			})
		);
	});
});
