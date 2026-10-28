import { describe, expect, test } from "bun:test";
import { accountHref, accountWarning, accountWarningText, allocationsHref, transferDirection } from "@/lib/account-links";

const asset = (balance: number) => ({ current_balance: balance, credit_limit: null, account_type: { class: "asset" } });
const card = (balance: number, limit: number | null) => ({
	current_balance: balance,
	credit_limit: limit,
	account_type: { class: "liability" },
});

describe("allocationsHref", () => {
	test("opens the month of the date, without leading zeros", () => {
		expect(allocationsHref("2026-03-07")).toBe("/allocations?year=2026&month=3");
	});

	test("adds the transaction to open", () => {
		expect(allocationsHref("2026-10-31", "tx-1")).toBe("/allocations?year=2026&month=10&transaction=tx-1");
	});

	test("ignores a time part", () => {
		expect(allocationsHref("2026-12-01T00:00:00.000Z", "tx-2")).toBe(
			"/allocations?year=2026&month=12&transaction=tx-2"
		);
	});
});

describe("accountHref", () => {
	test("points at the account page", () => {
		expect(accountHref("acc-1")).toBe("/accounts/acc-1");
	});
});

describe("transferDirection", () => {
	test("an asset leg that lost money went to the other account", () => {
		expect(transferDirection(-300, false)).toBe("to");
		expect(transferDirection(300, false)).toBe("from");
	});

	test("a liability leg whose debt went up sent money out (cash advance)", () => {
		expect(transferDirection(200, true)).toBe("to");
	});

	test("a liability leg whose debt went down was paid from the other account", () => {
		expect(transferDirection(-300, true)).toBe("from");
	});
});

describe("accountWarning", () => {
	test("an asset at or above zero is fine", () => {
		expect(accountWarning(asset(0))).toBeNull();
		expect(accountWarning(asset(40))).toBeNull();
	});

	test("an asset below zero is flagged", () => {
		expect(accountWarning(asset(-20))).toBe("below_zero");
	});

	test("a card at its limit is fine, past it is flagged", () => {
		expect(accountWarning(card(5000, 5000))).toBeNull();
		expect(accountWarning(card(5015, 5000))).toBe("past_limit");
	});

	test("a card with no limit is never past it", () => {
		expect(accountWarning(card(99999, null))).toBeNull();
	});

	test("decimal balances from the database are compared as numbers", () => {
		expect(accountWarning({ ...card(0, 0), current_balance: "500.01" as unknown as number, credit_limit: 500 })).toBe(
			"past_limit"
		);
	});
});

describe("accountWarningText", () => {
	test("names the account", () => {
		expect(accountWarningText("below_zero", "Chequing")).toBe("Chequing is below zero");
		expect(accountWarningText("past_limit", "Visa")).toBe("Visa is past its credit limit");
	});
});
