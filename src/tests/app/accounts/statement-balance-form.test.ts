import { describe, expect, test } from "bun:test";
import {
	statementBalanceUpdate,
	statementForEntry,
	toStatementBalanceInput,
} from "@/app/accounts/statement-balance-form";

// Due the 21st, closing 21 days before: on 2 November the latest statement closed 31 October.
const today = "2026-11-02";
const cycle = { closeDate: "2026-10-31", dueDate: "2026-11-21" };

describe("statementForEntry", () => {
	test("is the latest statement closed before today", () => {
		expect(statementForEntry("21", "", today)).toEqual(cycle);
		expect(statementForEntry("20", "25", today)).toEqual({ closeDate: "2026-10-25", dueDate: "2026-11-20" });
	});

	test("is null without a due day", () => {
		expect(statementForEntry("", "25", today)).toBeNull();
	});
});

describe("toStatementBalanceInput", () => {
	test("ties the balance to the statement's close date", () => {
		expect(toStatementBalanceInput("500.25", cycle)).toEqual({
			statement_balance: 500.25,
			statement_balance_date: "2026-10-31",
		});
	});

	test("saves nothing when blank or without a statement", () => {
		expect(toStatementBalanceInput("", cycle)).toEqual({});
		expect(toStatementBalanceInput("500", null)).toEqual({});
	});
});

describe("statementBalanceUpdate", () => {
	const base = { initial: "650.00", initialCloseDate: "2026-10-31", cycle, balanceChanged: false };

	test("saves an edited statement balance", () => {
		expect(statementBalanceUpdate({ ...base, value: "500" })).toEqual({
			statement_balance: 500,
			statement_balance_date: "2026-10-31",
		});
	});

	test("saves nothing when neither balance changed", () => {
		expect(statementBalanceUpdate({ ...base, value: "650.00" })).toEqual({});
	});

	test("keeps the statement shown when only the current balance changed", () => {
		// Typing the current balance from 650 to 900 would otherwise move a worked-back statement to 900.
		expect(statementBalanceUpdate({ ...base, value: "650.00", balanceChanged: true })).toEqual({
			statement_balance: 650,
			statement_balance_date: "2026-10-31",
		});
	});

	test("doesn't carry the shown balance to a different statement", () => {
		// The due day changed, so the shown 650 belonged to another close.
		const moved = { closeDate: "2026-10-25", dueDate: "2026-11-20" };
		expect(statementBalanceUpdate({ ...base, value: "650.00", balanceChanged: true, cycle: moved })).toEqual({});
	});

	test("clears a cleared statement balance", () => {
		expect(statementBalanceUpdate({ ...base, value: "" })).toEqual({
			statement_balance: null,
			statement_balance_date: null,
		});
	});
});
