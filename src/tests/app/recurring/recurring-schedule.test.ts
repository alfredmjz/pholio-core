import { describe, expect, test } from "bun:test";
import { monthlyEquivalent, occurrencesInMonth, parsePeriod } from "@/app/recurring/recurring-schedule";

describe("parsePeriod", () => {
	test("reads the n:unit form and the legacy words", () => {
		expect(parsePeriod("3:months")).toEqual({ value: 3, unit: "months" });
		expect(parsePeriod("2:weeks")).toEqual({ value: 2, unit: "weeks" });
		expect(parsePeriod("biweekly")).toEqual({ value: 2, unit: "weeks" });
		expect(parsePeriod("yearly")).toEqual({ value: 1, unit: "years" });
	});

	test("falls back to monthly for anything unknown", () => {
		expect(parsePeriod("")).toEqual({ value: 1, unit: "months" });
		expect(parsePeriod("fortnightly")).toEqual({ value: 1, unit: "months" });
		expect(parsePeriod("0:months")).toEqual({ value: 1, unit: "months" });
	});
});

describe("monthlyEquivalent", () => {
	test("spreads each period over an average month", () => {
		expect(monthlyEquivalent(15.99, "monthly")).toBeCloseTo(15.99, 6);
		// A quarterly bill: 300 every 3 months is 100 a month
		expect(monthlyEquivalent(300, "3:months")).toBe(100);
		// A yearly fee: 120 a year is 10 a month
		expect(monthlyEquivalent(120, "1:years")).toBe(10);
		// Weekly: 52 payments a year over 12 months
		expect(monthlyEquivalent(30, "weekly")).toBeCloseTo((30 * 52) / 12, 6);
		// Every two weeks: half of that
		expect(monthlyEquivalent(30, "2:weeks")).toBeCloseTo((30 * 52) / 24, 6);
	});
});

describe("occurrencesInMonth", () => {
	test("a monthly bill not yet paid this month is upcoming", () => {
		expect(occurrencesInMonth("2026-10-28", "monthly", 2026, 10, "2026-10-20")).toEqual([
			{ date: "2026-10-28", state: "upcoming" },
		]);
	});

	test("a monthly bill already paid moved to next month, so this month's date shows paid", () => {
		expect(occurrencesInMonth("2026-11-05", "monthly", 2026, 10, "2026-10-20")).toEqual([
			{ date: "2026-10-05", state: "paid" },
		]);
	});

	test("unpaid dates before today are overdue, today is due today", () => {
		expect(occurrencesInMonth("2026-10-15", "monthly", 2026, 10, "2026-10-20")).toEqual([
			{ date: "2026-10-15", state: "overdue" },
		]);
		expect(occurrencesInMonth("2026-10-20", "monthly", 2026, 10, "2026-10-20")[0].state).toBe("due_today");
	});

	test("a weekly item lands on every matching day in the month", () => {
		// Next unpaid Oct 13; Oct 6 was paid; Oct 20 is today; Oct 27 is upcoming.
		expect(occurrencesInMonth("2026-10-13", "weekly", 2026, 10, "2026-10-20")).toEqual([
			{ date: "2026-10-06", state: "paid" },
			{ date: "2026-10-13", state: "overdue" },
			{ date: "2026-10-20", state: "due_today" },
			{ date: "2026-10-27", state: "upcoming" },
		]);
	});

	test("an item due in a later month has nothing this month", () => {
		expect(occurrencesInMonth("2026-12-15", "3:months", 2026, 10, "2026-10-20")).toEqual([]);
	});

	test("ISO timestamps are read by their date", () => {
		expect(occurrencesInMonth("2026-10-28T04:00:00.000Z", "monthly", 2026, 10, "2026-10-20")[0].date).toBe(
			"2026-10-28"
		);
	});
});
