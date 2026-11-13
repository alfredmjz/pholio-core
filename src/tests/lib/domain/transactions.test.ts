import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mockModule } from "@/tests/support/mock-module";
import { ActionError } from "@/lib/action-result";
import type { AccountWithType } from "@/app/accounts/types";
import type { SavedBudgetRow, TransactionStore } from "@/lib/actions/transaction-store";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";

type Domain = typeof import("@/lib/domain/transactions");

const accounts = new Map<string, AccountWithType>();
let savedRow: SavedBudgetRow | null = null;
const writes: string[] = [];

const fakeStore: TransactionStore = {
	listSelectableAccounts: async () => Array.from(accounts.values()),
	listUsedDescriptions: async () => [],
	getAccount: async (id) => accounts.get(id) ?? null,
	getBudgetRow: async () => savedRow,
	insertBudgetRow: async (row) => {
		writes.push(`budget ${row.amount}`);
		return "budget-1";
	},
	updateBudgetRow: async () => {},
	linkBudgetRow: async () => {},
	deleteBudgetRow: async () => {},
	getLedgerRow: async () => null,
	insertLedgerRow: async (row) => {
		writes.push(`ledger ${row.accountId} ${row.amount}`);
		return `ledger-${row.accountId}`;
	},
	updateLedgerRow: async () => {},
	linkTransferLegs: async () => {},
	deleteLedgerRow: async () => {},
	adjustBalance: async (accountId, delta) => {
		writes.push(`balance ${accountId} ${delta}`);
	},
	setBalance: async () => {},
	updateUnified: async () => {
		writes.push("update");
		return true;
	},
	deleteUnified: async () => true,
};

const ctx = { kind: "demo", userId: "sample-user", session: "s1" } as const;
let domain: Domain;

beforeAll(async () => {
	await mockModule("@/lib/actions/transaction-store", { transactionStore: () => fakeStore });
	domain = await import("@/lib/domain/transactions");
});

beforeEach(() => {
	accounts.clear();
	savedRow = null;
	writes.length = 0;
});

function account(
	id: string,
	accountClass: "asset" | "liability",
	balance: number,
	extra: Partial<AccountWithType> = {}
): AccountWithType {
	const value = {
		id,
		name: id,
		current_balance: balance,
		credit_limit: null,
		original_amount: null,
		overdraft_protection: false,
		overdraft_limit: null,
		account_type: { class: accountClass, code: accountClass === "asset" ? "chequing" : "credit_card" },
		...extra,
	} as unknown as AccountWithType;
	accounts.set(id, value);
	return value;
}

function input(overrides: Partial<UnifiedTransactionInput>): UnifiedTransactionInput {
	return { description: "Test", amount: 0, date: "2026-11-13", type: "expense", ...overrides };
}

async function rejection(promise: Promise<unknown>): Promise<ActionError> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ActionError) return error;
		throw error;
	}
	throw new Error("Expected the call to be rejected");
}

describe("createTransaction caps on an asset", () => {
	test("an expense equal to the balance is recorded", async () => {
		account("chq", "asset", 100);
		await domain.createTransaction(ctx, input({ accountId: "chq", amount: 100 }));
		expect(writes).toEqual(["budget -100", "ledger chq -100", "balance chq -100"]);
	});

	test("an expense one cent over the balance is rejected before anything is written", async () => {
		account("chq", "asset", 100);
		const error = await rejection(domain.createTransaction(ctx, input({ accountId: "chq", amount: 100.01 })));
		expect(error.code).toBe("invalid_input");
		expect(error.message).toBe("Amount ($100.01) exceeds available account balance ($100.00).");
		expect(writes).toEqual([]);
	});

	test("overdraft protection adds the overdraft limit to what can leave", async () => {
		account("chq", "asset", 100, { overdraft_protection: true, overdraft_limit: 50 });
		await domain.createTransaction(ctx, input({ accountId: "chq", amount: 150 }));

		const error = await rejection(domain.createTransaction(ctx, input({ accountId: "chq", amount: 150.01 })));
		expect(error.message).toBe("Amount ($150.01) exceeds available account balance ($150.00).");
	});

	test("an overdraft limit without protection does not count", async () => {
		account("chq", "asset", 100, { overdraft_protection: false, overdraft_limit: 50 });
		const error = await rejection(domain.createTransaction(ctx, input({ accountId: "chq", amount: 100.01 })));
		expect(error.message).toBe("Amount ($100.01) exceeds available account balance ($100.00).");
	});

	test("a deposit is never capped", async () => {
		account("chq", "asset", 0);
		await domain.createTransaction(ctx, input({ type: "income", accountId: "chq", amount: 5000 }));
		expect(writes).toContain("balance chq 5000");
	});
});

describe("createTransaction caps on a liability", () => {
	test("a payment equal to the remaining debt is recorded", async () => {
		account("card", "liability", 500);
		await domain.createTransaction(
			ctx,
			input({ type: "income", transactionType: "payment", accountId: "card", amount: 500 })
		);
		expect(writes).toContain("balance card -500");
	});

	test("a payment one cent over the remaining debt is rejected", async () => {
		account("card", "liability", 500);
		const error = await rejection(
			domain.createTransaction(
				ctx,
				input({ type: "income", transactionType: "payment", accountId: "card", amount: 500.01 })
			)
		);
		expect(error.message).toBe("Amount ($500.01) exceeds remaining debt ($500.00).");
		expect(writes).toEqual([]);
	});

	test("the Allow Overpayment opt-in lets the payment through", async () => {
		account("card", "liability", 500);
		await domain.createTransaction(
			ctx,
			input({ type: "income", transactionType: "payment", accountId: "card", amount: 600, allowOverpayment: true })
		);
		expect(writes).toContain("balance card -600");
	});

	test("a charge beyond the available credit is rejected", async () => {
		account("card", "liability", 900, { credit_limit: 1000 });
		const error = await rejection(domain.createTransaction(ctx, input({ accountId: "card", amount: 100.01 })));
		expect(error.message).toBe("Amount ($100.01) exceeds available credit ($100.00).");
	});
});

describe("createTransaction caps on a transfer", () => {
	test("out of an asset: up to the balance moves, one cent more is rejected", async () => {
		account("chq", "asset", 200);
		account("sav", "asset", 0);
		await domain.createTransaction(
			ctx,
			input({ type: "transfer", fromAccountId: "chq", toAccountId: "sav", amount: 200 })
		);
		expect(writes).toEqual(["budget 200", "ledger chq -200", "balance chq -200", "ledger sav 200", "balance sav 200"]);

		writes.length = 0;
		const error = await rejection(
			domain.createTransaction(
				ctx,
				input({ type: "transfer", fromAccountId: "chq", toAccountId: "sav", amount: 200.01 })
			)
		);
		expect(error.message).toBe("Amount ($200.01) exceeds available account balance ($200.00).");
		expect(writes).toEqual([]);
	});

	test("out of a liability: capped by the available credit", async () => {
		account("loc", "liability", 900, { credit_limit: 1000 });
		account("chq", "asset", 0);
		await domain.createTransaction(
			ctx,
			input({ type: "transfer", fromAccountId: "loc", toAccountId: "chq", amount: 100 })
		);
		expect(writes).toContain("ledger loc 100");

		const error = await rejection(
			domain.createTransaction(
				ctx,
				input({ type: "transfer", fromAccountId: "loc", toAccountId: "chq", amount: 100.01 })
			)
		);
		expect(error.message).toBe("Amount ($100.01) exceeds available credit ($100.00).");
	});

	test("into a liability (Pay Remaining): capped at the remaining debt unless overpayment is allowed", async () => {
		account("chq", "asset", 1000);
		account("card", "liability", 300);
		await domain.createTransaction(
			ctx,
			input({ type: "transfer", fromAccountId: "chq", toAccountId: "card", amount: 300 })
		);
		expect(writes).toContain("ledger card -300");

		const error = await rejection(
			domain.createTransaction(
				ctx,
				input({ type: "transfer", fromAccountId: "chq", toAccountId: "card", amount: 300.01 })
			)
		);
		expect(error.message).toBe("Amount ($300.01) exceeds remaining debt ($300.00).");

		writes.length = 0;
		await domain.createTransaction(
			ctx,
			input({ type: "transfer", fromAccountId: "chq", toAccountId: "card", amount: 350, allowOverpayment: true })
		);
		expect(writes).toContain("ledger card -350");
	});

	test("the opt-in never lifts the source account's balance cap", async () => {
		account("chq", "asset", 100);
		account("card", "liability", 300);
		const error = await rejection(
			domain.createTransaction(
				ctx,
				input({ type: "transfer", fromAccountId: "chq", toAccountId: "card", amount: 100.01, allowOverpayment: true })
			)
		);
		expect(error.message).toBe("Amount ($100.01) exceeds available account balance ($100.00).");
	});

	test("rejects a transfer without two different accounts", async () => {
		account("chq", "asset", 100);
		const missing = await rejection(
			domain.createTransaction(ctx, input({ type: "transfer", fromAccountId: "chq", amount: 1 }))
		);
		expect(missing.message).toBe("Please select both source and destination accounts for the transfer");
		const same = await rejection(
			domain.createTransaction(ctx, input({ type: "transfer", fromAccountId: "chq", toAccountId: "chq", amount: 1 }))
		);
		expect(same.message).toBe("Source and destination accounts must be different");
	});
});

describe("updateTransaction caps", () => {
	test("an edit is capped against the balance without the row's own amount", async () => {
		account("chq", "asset", 20);
		savedRow = { id: "row", source: "manual", recurringExpenseId: null, legs: [{ accountId: "chq", amount: -80 }] };

		await domain.updateTransaction(ctx, "row", input({ accountId: "chq", amount: 100 }));
		expect(writes).toEqual(["update"]);

		writes.length = 0;
		const error = await rejection(domain.updateTransaction(ctx, "row", input({ accountId: "chq", amount: 100.01 })));
		expect(error.message).toBe("Amount ($100.01) exceeds available account balance ($100.00).");
		expect(writes).toEqual([]);
	});

	test("moving a row to another account is capped by that account's full balance", async () => {
		account("chq", "asset", 20);
		account("sav", "asset", 50);
		savedRow = { id: "row", source: "manual", recurringExpenseId: null, legs: [{ accountId: "chq", amount: -80 }] };
		const error = await rejection(domain.updateTransaction(ctx, "row", input({ accountId: "sav", amount: 50.01 })));
		expect(error.message).toBe("Amount ($50.01) exceeds available account balance ($50.00).");
	});

	test("a transfer edit gives back both legs before checking", async () => {
		account("chq", "asset", 0);
		account("card", "liability", 0);
		savedRow = {
			id: "row",
			source: "transfer",
			recurringExpenseId: null,
			legs: [
				{ accountId: "chq", amount: -200 },
				{ accountId: "card", amount: -200 },
			],
		};
		await domain.updateTransaction(
			ctx,
			"row",
			input({ type: "transfer", fromAccountId: "chq", toAccountId: "card", amount: 200 })
		);
		const error = await rejection(
			domain.updateTransaction(
				ctx,
				"row",
				input({ type: "transfer", fromAccountId: "chq", toAccountId: "card", amount: 200.01 })
			)
		);
		expect(error.message).toBe("Amount ($200.01) exceeds available account balance ($200.00).");
	});

	test("a row posted by a recurring expense is never capped", async () => {
		account("chq", "asset", 0);
		savedRow = {
			id: "row",
			source: "recurring",
			recurringExpenseId: "rent",
			legs: [{ accountId: "chq", amount: -10 }],
		};
		await domain.updateTransaction(ctx, "row", input({ accountId: "chq", amount: 1200 }));
		expect(writes).toEqual(["update"]);
	});

	test("a missing row is not found", async () => {
		const error = await rejection(domain.updateTransaction(ctx, "gone", input({ amount: 1 })));
		expect(error.code).toBe("not_found");
	});
});

describe("ledger edits from the account page", () => {
	test("an incoming transfer leg on an asset stays an inflow when its amount changes", () => {
		const chq = account("chq", "asset", 500);
		expect(domain.editedLedgerAmount(chq, { amount: 200, transaction_type: "transfer" }, "transfer", 250)).toBe(250);
	});

	test("a refund stays an inflow when its amount changes", () => {
		const chq = account("chq", "asset", 500);
		expect(domain.editedLedgerAmount(chq, { amount: 30, transaction_type: "refund" }, "refund", 40)).toBe(40);
	});

	test("a new type takes that type's direction", () => {
		const chq = account("chq", "asset", 500);
		expect(domain.editedLedgerAmount(chq, { amount: -50, transaction_type: "withdrawal" }, "deposit", 50)).toBe(50);
	});

	test("a larger withdrawal is capped by the balance without the row's own amount", async () => {
		// Balance 100 after a 50 withdrawal: 150 was there before the row.
		const chq = account("chq", "asset", 100);
		expect(() => domain.assertLedgerEditWithinCaps(chq, -50, -150, "withdrawal")).not.toThrow();
		const error = await rejection(
			Promise.resolve().then(() => domain.assertLedgerEditWithinCaps(chq, -50, -150.01, "withdrawal"))
		);
		expect(error.code).toBe("invalid_input");
		expect(error.message).toContain("exceeds available account balance ($150.00)");
	});

	test("shrinking a row is never capped, even on an overdrawn account", () => {
		const chq = account("chq", "asset", -20);
		expect(() => domain.assertLedgerEditWithinCaps(chq, -50, -40, "withdrawal")).not.toThrow();
	});

	test("a larger payment is capped by the debt as it stood before the row", async () => {
		// Debt 300 after a 100 payment: 400 was owed before the row.
		const card = account("card", "liability", 300);
		expect(() => domain.assertLedgerEditWithinCaps(card, -100, -400, "payment")).not.toThrow();
		const error = await rejection(
			Promise.resolve().then(() => domain.assertLedgerEditWithinCaps(card, -100, -400.01, "payment"))
		);
		expect(error.message).toContain("exceeds remaining debt ($400.00)");
	});

	test("fee and interest rows the database posted are never capped", () => {
		const chq = account("chq", "asset", 0);
		expect(() => domain.assertLedgerEditWithinCaps(chq, -10, -500, "fee")).not.toThrow();
		expect(() => domain.assertLedgerEditWithinCaps(chq, -5, -500, "interest")).not.toThrow();
	});
});
