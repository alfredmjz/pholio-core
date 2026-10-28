import { describe, expect, test } from "bun:test";
import {
	coveredDueDate,
	earlyPaymentPlan,
	monthlyEquivalent,
	occurrencesInMonth,
	parsePeriod,
	paymentsForMonth,
	upcomingOccurrences,
} from "@/app/recurring/recurring-schedule";

describe("coveredDueDate", () => {
	test("a payment made early counts for the due date it covers", () => {
		expect(coveredDueDate({ transaction_date: "2026-10-26", covers_due_date: "2026-11-25" })).toBe("2026-11-25");
	});

	test("an older payment with no covered date counts for its own date", () => {
		expect(coveredDueDate({ transaction_date: "2026-10-25T00:00:00Z", covers_due_date: null })).toBe("2026-10-25");
	});
});

describe("paymentsForMonth", () => {
	// Phone, every 2 weeks: Oct 25 paid on time, then Nov 25 and Dec 9 paid early on Oct 26.
	const payments = [
		{ id: "oct", transaction_date: "2026-10-25", covers_due_date: "2026-10-25", recurring_expense_id: "phone" },
		{ id: "nov", transaction_date: "2026-10-26", covers_due_date: "2026-11-25", recurring_expense_id: "phone" },
		{ id: "dec", transaction_date: "2026-10-26", covers_due_date: "2026-12-09", recurring_expense_id: "phone" },
		{ id: "named", transaction_date: "2026-10-10", covers_due_date: null, recurring_expense_id: null },
	];
	const ids = (start: string, end: string) => paymentsForMonth(payments, start, end).map((p) => p.id);

	test("October counts only the bill due in October, plus name-matched payments made then", () => {
		expect(ids("2026-10-01", "2026-10-31")).toEqual(["oct", "named"]);
	});

	test("November and December count the bills paid early for them", () => {
		expect(ids("2026-11-01", "2026-11-30")).toEqual(["nov"]);
		expect(ids("2026-12-01", "2026-12-31")).toEqual(["dec"]);
	});
});

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

describe("upcomingOccurrences", () => {
	test("crosses into later months, up to a year after today", () => {
		const dates = upcomingOccurrences("2026-11-25", "2:weeks", "2026-10-25");
		expect(dates.slice(0, 4)).toEqual(["2026-11-25", "2026-12-09", "2026-12-23", "2027-01-06"]);
		expect(dates[dates.length - 1] <= "2027-10-25").toBe(true);
		// Every 2 weeks from Nov 25 up to Oct 25 next year: 24 dates, the cap.
		expect(dates).toHaveLength(24);
	});

	test("a monthly bill lists the next 12 months, including the date a year out", () => {
		const dates = upcomingOccurrences("2026-11-01", "1:months", "2026-11-01");
		expect(dates[0]).toBe("2026-11-01");
		expect(dates[dates.length - 1]).toBe("2027-11-01");
		expect(dates).toHaveLength(13);
	});

	test("a yearly bill due later than the horizon has nothing to pay early", () => {
		expect(upcomingOccurrences("2028-01-15", "yearly", "2026-10-25")).toEqual([]);
	});

	test("accepts a stored timestamp without shifting the day", () => {
		expect(upcomingOccurrences("2026-12-01T00:00:00.000Z", "monthly", "2026-11-20", 1)).toEqual(["2026-12-01"]);
	});
});

describe("earlyPaymentPlan", () => {
	// Every 2 weeks from Jan 1; the Jan 1 bill is paid, so the next one is due Jan 14.
	test("paying three bills on Jan 3 covers Jan 14, Jan 28 and Feb 11, then Feb 25 is next", () => {
		expect(earlyPaymentPlan("2027-01-14", "2:weeks", 3)).toEqual({
			covered: ["2027-01-14", "2027-01-28", "2027-02-11"],
			nextDue: "2027-02-25",
		});
	});

	test("one monthly bill moves the due date a month on", () => {
		expect(earlyPaymentPlan("2026-11-25", "monthly", 1)).toEqual({ covered: ["2026-11-25"], nextDue: "2026-12-25" });
	});

	test("matches the dates offered to pay early", () => {
		const offered = upcomingOccurrences("2027-01-14", "2:weeks", "2027-01-03");
		expect(earlyPaymentPlan("2027-01-14", "2:weeks", 5).covered).toEqual(offered.slice(0, 5));
	});
});
