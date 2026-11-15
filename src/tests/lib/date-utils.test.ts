import { describe, expect, test } from "bun:test";
import { calculateNextDueDate, formatPeriod, formatRelativeTime, parsePeriod, previousMonthOf } from "@/lib/date-utils";

describe("formatRelativeTime", () => {
	const now = new Date(2026, 9, 25, 12, 0, 0).getTime();
	const ago = (ms: number) => new Date(now - ms).toISOString();

	test("measures from the given moment, not the device clock", () => {
		expect(formatRelativeTime(ago(59_999), now)).toBe("Just now");
		expect(formatRelativeTime(ago(59_999), now + 1)).toBe("1m ago");
	});

	test("steps through minutes, hours and days", () => {
		expect(formatRelativeTime(ago(3 * 60_000), now)).toBe("3m ago");
		expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
		expect(formatRelativeTime(ago(30 * 3_600_000), now)).toBe("Yesterday");
		expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3d ago");
	});
});

describe("parsePeriod", () => {
	test("reads the n:unit form and the legacy words", () => {
		expect(parsePeriod("3:months")).toEqual({ value: 3, unit: "months" });
		expect(parsePeriod("2:weeks")).toEqual({ value: 2, unit: "weeks" });
		expect(parsePeriod("biweekly")).toEqual({ value: 2, unit: "weeks" });
		expect(parsePeriod("weekly")).toEqual({ value: 1, unit: "weeks" });
		expect(parsePeriod("yearly")).toEqual({ value: 1, unit: "years" });
		expect(parsePeriod("daily")).toEqual({ value: 1, unit: "days" });
		expect(parsePeriod(" Monthly ")).toEqual({ value: 1, unit: "months" });
	});

	test("anything unrecognised is monthly, and the count is at least 1", () => {
		expect(parsePeriod("fortnightly")).toEqual({ value: 1, unit: "months" });
		expect(parsePeriod("")).toEqual({ value: 1, unit: "months" });
		expect(parsePeriod("0:weeks")).toEqual({ value: 1, unit: "weeks" });
	});

	test("formatPeriod round-trips", () => {
		expect(parsePeriod(formatPeriod({ value: 4, unit: "weeks" }))).toEqual({ value: 4, unit: "weeks" });
	});
});

describe("calculateNextDueDate", () => {
	const from = new Date(2026, 0, 31);
	test("steps by the parsed period", () => {
		expect(calculateNextDueDate(new Date(2026, 10, 1), "weekly")).toEqual(new Date(2026, 10, 8));
		expect(calculateNextDueDate(new Date(2026, 10, 1), "biweekly")).toEqual(new Date(2026, 10, 15));
		expect(calculateNextDueDate(new Date(2026, 10, 1), "3:months")).toEqual(new Date(2027, 1, 1));
		expect(calculateNextDueDate(new Date(2026, 10, 1), "yearly")).toEqual(new Date(2027, 10, 1));
		expect(calculateNextDueDate(new Date(2026, 10, 1), "10:days")).toEqual(new Date(2026, 10, 11));
	});

	test("an unknown period steps one month rather than standing still", () => {
		expect(calculateNextDueDate(from, "nonsense").getMonth()).not.toBe(0);
	});
});

describe("previousMonthOf", () => {
	test("rolls back over the year boundary", () => {
		expect(previousMonthOf(2026, 11)).toEqual({ year: 2026, month: 10 });
		expect(previousMonthOf(2026, 1)).toEqual({ year: 2025, month: 12 });
	});
});
