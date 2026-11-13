import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { ActionError } from "@/lib/action-result";
import type { AccountStore } from "@/app/accounts/account-store";
import type { AccountWithType, CreateAccountInput } from "@/app/accounts/types";
import { sampleAccounts } from "@/mock-data/accounts";

type Domain = typeof import("@/lib/domain/accounts");

const deposits: Array<{ accountId: string; amount: number }> = [];
let storedBalance: number | null = null;
let updated: Record<string, unknown> | null = null;
let removeResult = true;
let depositFails = false;

const fakeStore = {
	create: async (input: CreateAccountInput) => ({
		id: "acc-new",
		track_contribution_room: Boolean(input.track_contribution_room),
		current_balance: input.current_balance,
	}),
	getBalance: async () => storedBalance,
	update: async () => updated,
	remove: async () => removeResult,
	insertDeposit: async (accountId: string, amount: number) => {
		if (depositFails) throw new Error("db down");
		deposits.push({ accountId, amount });
	},
} as unknown as AccountStore;

mock.module("@/app/accounts/account-store", () => ({ accountStore: () => fakeStore }));
mock.module("@/lib/logger", () => ({ Logger: { error: () => {}, warn: () => {}, info: () => {} } }));

const ctx = { kind: "demo", userId: "sample-user", session: "s1" } as const;
let domain: Domain;

beforeAll(async () => {
	domain = await import("@/lib/domain/accounts");
});

beforeEach(() => {
	deposits.length = 0;
	storedBalance = null;
	updated = null;
	removeResult = true;
	depositFails = false;
});

async function rejection(promise: Promise<unknown>): Promise<ActionError> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ActionError) return error;
		throw error;
	}
	throw new Error("expected the call to reject");
}

describe("createAccount", () => {
	test("ledgers the opening balance of a room-tracked account as a deposit", async () => {
		await domain.createAccount(ctx, {
			name: "TFSA",
			account_type_id: "t",
			current_balance: 1200.5,
			track_contribution_room: true,
		});
		expect(deposits).toEqual([{ accountId: "acc-new", amount: 1200.5 }]);
	});

	test("records nothing for an account that does not track room or opens at zero", async () => {
		await domain.createAccount(ctx, { name: "Chequing", account_type_id: "t", current_balance: 500 });
		await domain.createAccount(ctx, {
			name: "TFSA",
			account_type_id: "t",
			current_balance: 0,
			track_contribution_room: true,
		});
		expect(deposits).toEqual([]);
	});

	test("still creates the account when the deposit row fails to save", async () => {
		depositFails = true;
		const account = await domain.createAccount(ctx, {
			name: "TFSA",
			account_type_id: "t",
			current_balance: 100,
			track_contribution_room: true,
		});
		expect(account.id).toBe("acc-new");
	});
});

describe("updateAccount", () => {
	test("ledgers only the increase when a room-tracked balance goes up", async () => {
		storedBalance = 1000;
		updated = { id: "a1", track_contribution_room: true, current_balance: 1250.25 };
		await domain.updateAccount(ctx, "a1", { current_balance: 1250.25 });
		expect(deposits).toEqual([{ accountId: "a1", amount: 250.25 }]);
	});

	test("records nothing when the balance drops", async () => {
		storedBalance = 1000;
		updated = { id: "a1", track_contribution_room: true, current_balance: 900 };
		await domain.updateAccount(ctx, "a1", { current_balance: 900 });
		expect(deposits).toEqual([]);
	});

	test("does not look at the balance when the update leaves it alone", async () => {
		storedBalance = 1000;
		updated = { id: "a1", track_contribution_room: true, current_balance: 5000 };
		await domain.updateAccount(ctx, "a1", { notes: "hi" });
		expect(deposits).toEqual([]);
	});

	test("rejects as not found when no row was updated", async () => {
		const error = await rejection(domain.updateAccount(ctx, "gone", { notes: "x" }));
		expect(error.code).toBe("not_found");
	});
});

describe("deleteAccount", () => {
	test("rejects as not found when nothing was deleted", async () => {
		removeResult = false;
		const error = await rejection(domain.deleteAccount(ctx, "gone"));
		expect(error.code).toBe("not_found");
	});
});

describe("type migration", () => {
	test("suggests a type from the retired category, never the name", () => {
		expect(domain.suggestCodeForLegacyCategory("retirement")).toBe("investment");
		expect(domain.suggestCodeForLegacyCategory("credit")).toBe("credit_card");
		expect(domain.suggestCodeForLegacyCategory("debt")).toBe("loan");
		expect(domain.suggestCodeForLegacyCategory("property")).toBe("other");
		expect(domain.suggestCodeForLegacyCategory(null)).toBe("chequing");
	});

	test("lists accounts with a retired or code-less type", () => {
		const retired = { id: "r", account_type: { is_active: false, code: "chequing", category: "banking" } };
		const codeless = { id: "c", account_type: { is_active: true, code: null, category: "credit" } };
		const items = domain.accountsNeedingTypeMigration([retired, codeless] as unknown as AccountWithType[]);
		expect(items.map((item) => [item.account.id, item.suggestedCode])).toEqual([
			["r", "chequing"],
			["c", "credit_card"],
		]);
	});

	test("the demo accounts need no migration", () => {
		expect(domain.accountsNeedingTypeMigration(sampleAccounts)).toEqual([]);
	});
});
