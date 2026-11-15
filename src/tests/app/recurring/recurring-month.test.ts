import { describe, expect, test } from "bun:test";
import {
	expandRecurringMonth,
	occurrenceDatesInMonth,
	resolveRecurringCategoryName,
} from "@/app/recurring/recurring-occurrence";

describe("occurrenceDatesInMonth", () => {
	test("a monthly bill falls once in the month, whichever month its next due date is in", () => {
		expect(occurrenceDatesInMonth("2026-11-15", "1:months", 2026, 11)).toEqual(["2026-11-15"]);
		expect(occurrenceDatesInMonth("2026-11-15", "1:months", 2026, 8)).toEqual(["2026-08-15"]);
		expect(occurrenceDatesInMonth("2026-11-15", "monthly", 2027, 2)).toEqual(["2027-02-15"]);
	});

	test("a weekly bill falls on every seventh day in the month", () => {
		expect(occurrenceDatesInMonth("2026-11-04", "1:weeks", 2026, 11)).toEqual([
			"2026-11-04",
			"2026-11-11",
			"2026-11-18",
			"2026-11-25",
		]);
		expect(occurrenceDatesInMonth("2026-11-04", "weekly", 2026, 12)).toEqual([
			"2026-12-02",
			"2026-12-09",
			"2026-12-16",
			"2026-12-23",
			"2026-12-30",
		]);
	});

	test("a biweekly bill falls every 14 days", () => {
		expect(occurrenceDatesInMonth("2026-11-06", "biweekly", 2026, 11)).toEqual(["2026-11-06", "2026-11-20"]);
	});

	test("a yearly bill falls only in its own month", () => {
		expect(occurrenceDatesInMonth("2026-03-10", "1:years", 2026, 3)).toEqual(["2026-03-10"]);
		expect(occurrenceDatesInMonth("2026-03-10", "yearly", 2026, 4)).toEqual([]);
		expect(occurrenceDatesInMonth("2026-03-10", "yearly", 2025, 3)).toEqual(["2025-03-10"]);
	});

	test("a quarterly bill skips the months between", () => {
		expect(occurrenceDatesInMonth("2026-11-01", "3:months", 2026, 11)).toEqual(["2026-11-01"]);
		expect(occurrenceDatesInMonth("2026-11-01", "3:months", 2026, 12)).toEqual([]);
		expect(occurrenceDatesInMonth("2026-11-01", "3:months", 2027, 2)).toEqual(["2027-02-01"]);
	});

	test("an unrecognised period is read as monthly", () => {
		expect(occurrenceDatesInMonth("2026-11-15", "fortnightly", 2026, 12)).toEqual(["2026-12-15"]);
	});
});

describe("expandRecurringMonth", () => {
	const rent = { id: "rent", amount: 1200, next_due_date: "2026-11-01", billing_period: "1:months" };
	const gym = { id: "gym", amount: "40.50", next_due_date: "2026-11-05", billing_period: "weekly" };
	const insurance = { id: "ins", amount: 600, next_due_date: "2027-03-10", billing_period: "1:years" };

	test("sums the amount over each occurrence and drops expenses with none in the month", () => {
		const result = expandRecurringMonth([rent, gym, insurance], new Map(), 2026, 11);
		expect(result.map((r) => r.expense.id)).toEqual(["rent", "gym"]);
		expect(result[0].totalAmount).toBe(1200);
		expect(result[1].dates).toEqual(["2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26"]);
		expect(result[1].totalAmount).toBe(162);
	});

	test("a recorded occurrence counts at the amount captured then, as a positive number", () => {
		const recorded = new Map([
			["rent:2026-11-01", -1000],
			["gym:2026-11-12", 30],
		]);
		const result = expandRecurringMonth([rent, gym], recorded, 2026, 11);
		expect(result[0].totalAmount).toBe(1000);
		expect(result[1].totalAmount).toBe(40.5 + 30 + 40.5 + 40.5);
	});

	test("a recorded amount for another date does not apply", () => {
		const result = expandRecurringMonth([rent], new Map([["rent:2026-10-01", 5]]), 2026, 11);
		expect(result[0].totalAmount).toBe(1200);
	});
});

describe("resolveRecurringCategoryName", () => {
	test("a chosen budget category wins, trimmed", () => {
		expect(resolveRecurringCategoryName({ category: "bill", budget_category: "  Housing " })).toBe("Housing");
	});

	test("defaults to Bills or Subscriptions", () => {
		expect(resolveRecurringCategoryName({ category: "bill", budget_category: " " })).toBe("Bills");
		expect(resolveRecurringCategoryName({ category: "subscription" })).toBe("Subscriptions");
	});
});
