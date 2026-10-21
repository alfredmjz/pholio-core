import { describe, expect, test } from "bun:test";
import {
	calculateAccountStanding,
	calculateSignedDelta,
	checkTransactionCaps,
	isInvestmentAccount,
} from "@/lib/account-validation-utils";
import type { AccountTransaction } from "@/app/balancesheet/types";
import { makeAccount } from "../support/contribution-fixtures";

const chequing = makeAccount({ id: "chq", balance: 1000 });
const card = makeAccount({ id: "card", accountClass: "liability", balance: 300, creditLimit: 1000 });
const loan = makeAccount({ id: "loan", accountClass: "liability", code: "loan", category: "debt", balance: 400 });

const tx = (amount: number): AccountTransaction =>
	({
		id: `tx-${amount}`,
		account_id: "card",
		user_id: "user-1",
		amount,
		transaction_type: amount < 0 ? "payment" : "withdrawal",
		description: "",
		transaction_date: "2026-01-01",
		linked_allocation_transaction_id: null,
		created_at: "2026-01-01T00:00:00Z",
	}) as AccountTransaction;

describe("isInvestmentAccount", () => {
	test("is driven by the type code, with the legacy category bridge", () => {
		expect(isInvestmentAccount(makeAccount({ code: "investment", category: "investment" }))).toBe(true);
		expect(isInvestmentAccount(makeAccount({ code: null, category: "retirement" }))).toBe(true);
		expect(isInvestmentAccount(makeAccount({ code: "savings" }))).toBe(false);
		expect(isInvestmentAccount(null)).toBe(false);
	});
});

describe("calculateSignedDelta", () => {
	test("asset income types add and everything else subtracts", () => {
		for (const type of ["deposit", "contribution", "refund", "interest"]) {
			expect(calculateSignedDelta(chequing, "income", type, 50)).toBe(50);
		}
		expect(calculateSignedDelta(chequing, "expense", "withdrawal", 50)).toBe(-50);
		expect(calculateSignedDelta(chequing, "income", undefined, -50)).toBe(50);
	});

	test("liability payments and refunds reduce debt; charges increase it", () => {
		expect(calculateSignedDelta(card, "income", "payment", 50)).toBe(-50);
		expect(calculateSignedDelta(card, "expense", "refund", 50)).toBe(-50);
		expect(calculateSignedDelta(card, "expense", undefined, 50)).toBe(50);
	});

	test("transfers follow the account class, ignoring the transaction type", () => {
		expect(calculateSignedDelta(chequing, "transfer", "deposit", 50)).toBe(-50);
		expect(calculateSignedDelta(card, "transfer", "payment", 50)).toBe(50);
	});
});

describe("calculateAccountStanding", () => {
	test("assets cap transactions at the available balance", () => {
		const standing = calculateAccountStanding(chequing);
		expect(standing).toMatchObject({ accountClass: "asset", availableBalance: 1000, maxAllowedTransaction: 1000 });
		expect(calculateAccountStanding(makeAccount({ balance: -20 })).maxAllowedTransaction).toBe(0);
	});

	test("liabilities without a ledger infer payments from the original amount", () => {
		const standing = calculateAccountStanding(makeAccount({ ...loanOptions(), originalAmount: 1000 }));
		expect(standing).toMatchObject({ remainingDebt: 400, totalPayments: 600, totalAccumulatedDebt: 1000 });
	});

	test("liabilities with a ledger count negative rows as payments", () => {
		const standing = calculateAccountStanding(card, [tx(500), tx(-150), tx(-50)]);
		expect(standing).toMatchObject({
			remainingDebt: 300,
			totalPayments: 200,
			totalAccumulatedDebt: 500,
			availableCredit: 700,
		});
		// The three figures on the card always reconcile.
		expect(standing.totalAccumulatedDebt - standing.totalPayments).toBe(standing.remainingDebt);
	});

	test("liabilities without a credit limit have unlimited available credit", () => {
		expect(calculateAccountStanding(loan).availableCredit).toBe(Infinity);
	});
});

function loanOptions() {
	return { id: "loan", accountClass: "liability" as const, code: "loan" as const, category: "debt", balance: 400 };
}

describe("checkTransactionCaps", () => {
	test("asset outflows cannot exceed the balance, and cannot be overridden", () => {
		const result = checkTransactionCaps({ intent: "expense", amount: 1200, account: chequing, allowOverpayment: true });
		expect(result.isValid).toBe(false);
		expect(result.violations[0]).toMatchObject({ field: "accountId", maxAllowed: 1000, overridable: false });
	});

	test("asset deposits are never capped", () => {
		expect(checkTransactionCaps({ intent: "income", amount: 1e9, account: chequing }).isValid).toBe(true);
	});

	test("paying more than the debt needs the overpayment opt-in", () => {
		const params = { intent: "income" as const, amount: 500, account: card, transactionType: "payment" };
		const blocked = checkTransactionCaps(params);
		expect(blocked.violations[0]).toMatchObject({ maxAllowed: 300, overridable: true });
		expect(checkTransactionCaps({ ...params, allowOverpayment: true }).isValid).toBe(true);
	});

	test("charges cannot exceed the available credit", () => {
		const result = checkTransactionCaps({ intent: "expense", amount: 800, account: card });
		expect(result.violations[0]).toMatchObject({ maxAllowed: 700, overridable: false });
	});

	test("transfers check both the source and the destination", () => {
		const result = checkTransactionCaps({ intent: "transfer", amount: 1200, fromAccount: chequing, toAccount: card });
		expect(result.violations.map((v) => v.field)).toEqual(["fromAccountId", "toAccountId"]);
		expect(
			checkTransactionCaps({ intent: "transfer", amount: 300, fromAccount: chequing, toAccount: card }).isValid
		).toBe(true);
	});

	test("zero or negative amounts are always valid", () => {
		expect(checkTransactionCaps({ intent: "expense", amount: 0, account: chequing }).isValid).toBe(true);
		expect(checkTransactionCaps({ intent: "expense", amount: -5, account: chequing }).isValid).toBe(true);
	});
});
