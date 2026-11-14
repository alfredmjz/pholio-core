import { describe, expect, test } from "bun:test";
import { describeBudgetLeft, describePace, getBudgetPace, getMonthDays } from "@/app/allocations/utils/month-pace";

const fmt = (amount: number) => `$${Math.round(amount)}`;

describe("getMonthDays", () => {
	test("counts today among the days left in the current month", () => {
		expect(getMonthDays(2026, 11, "2026-11-13")).toEqual({
			daysInMonth: 30,
			phase: "current",
			daysElapsed: 12,
			daysLeft: 18,
		});
	});

	test("the first and last day of the month", () => {
		expect(getMonthDays(2026, 11, "2026-11-01")).toMatchObject({ daysElapsed: 0, daysLeft: 30 });
		expect(getMonthDays(2026, 11, "2026-11-30")).toMatchObject({ daysElapsed: 29, daysLeft: 1 });
	});

	test("uses the month's real length, including leap years", () => {
		expect(getMonthDays(2028, 2, "2028-02-10").daysInMonth).toBe(29);
		expect(getMonthDays(2027, 2, "2027-02-10").daysInMonth).toBe(28);
		expect(getMonthDays(2026, 12, "2026-12-10").daysInMonth).toBe(31);
	});

	test("a past month has every day gone, across a year boundary too", () => {
		expect(getMonthDays(2026, 10, "2026-11-13")).toEqual({
			daysInMonth: 31,
			phase: "past",
			daysElapsed: 31,
			daysLeft: 0,
		});
		expect(getMonthDays(2026, 12, "2027-01-02").phase).toBe("past");
	});

	test("a future month has every day still to come", () => {
		expect(getMonthDays(2026, 12, "2026-11-13")).toEqual({
			daysInMonth: 31,
			phase: "future",
			daysElapsed: 0,
			daysLeft: 31,
		});
		expect(getMonthDays(2027, 1, "2026-12-31").phase).toBe("future");
	});
});

describe("getBudgetPace", () => {
	const nov13 = getMonthDays(2026, 11, "2026-11-13");

	test("fills segments in proportion to spending", () => {
		const pace = getBudgetPace(nov13, 600, 255);
		expect(pace.left).toBe(345);
		expect(pace.over).toBe(false);
		expect(pace.filledDays).toBeCloseTo(12.75, 5);
	});

	test("spreads what's left over the days left, today included", () => {
		// $345 over 18 days.
		expect(getBudgetPace(nov13, 600, 255).perDay).toBeCloseTo(19.1667, 3);
	});

	test("on pace while spending stays within an even share through today", () => {
		// 13 of 30 days, today included: $260 of $600.
		expect(getBudgetPace(nov13, 600, 260).aheadBy).toBe(0);
		expect(getBudgetPace(nov13, 600, 255).aheadBy).toBe(0);
	});

	test("ahead of pace by what was spent past the even share", () => {
		// 13 of 30 days of $200 is $86.67.
		expect(getBudgetPace(nov13, 200, 150).aheadBy).toBeCloseTo(63.33, 2);
	});

	test("running past the allowance by less than a day's share is still on pace", () => {
		// $260 allowed through today; $278 is $18 past, under a $20 day.
		expect(getBudgetPace(nov13, 600, 278).aheadBy).toBe(0);
		expect(getBudgetPace(nov13, 600, 281).aheadBy).toBe(21);
	});

	test("recurring bills count as allowed from the first day", () => {
		// $1,500 rent plus $300 flexible: $1,500 + 13 days of $10 = $1,630 allowed.
		expect(getBudgetPace(nov13, 1800, 1600, 1500).aheadBy).toBe(0);
		expect(getBudgetPace(nov13, 1800, 1700, 1500).aheadBy).toBe(70);
		// Bills above the budget never allow more than the budget.
		expect(getBudgetPace(nov13, 300, 300, 500).aheadBy).toBe(0);
	});

	test("a budget used in full is not called ahead of pace", () => {
		expect(getBudgetPace(nov13, 2000, 2000).aheadBy).toBe(0);
	});

	test("spending on the first day is not ahead of pace while within a day's share", () => {
		expect(getBudgetPace(getMonthDays(2026, 11, "2026-11-01"), 600, 15).aheadBy).toBe(0);
	});

	test("over budget fills every segment and has no daily amount", () => {
		const pace = getBudgetPace(nov13, 200, 215);
		expect(pace.over).toBe(true);
		expect(pace.left).toBe(-15);
		expect(pace.filledDays).toBe(30);
		expect(pace.perDay).toBeNull();
		expect(pace.aheadBy).toBe(0);
	});

	test("no budget fills nothing", () => {
		const pace = getBudgetPace(nov13, 0, 45);
		expect(pace.filledDays).toBe(0);
		expect(pace.over).toBe(false);
		expect(pace.perDay).toBeNull();
	});

	test("a past month is never ahead of pace and has no daily amount", () => {
		const pace = getBudgetPace(getMonthDays(2026, 10, "2026-11-13"), 200, 199);
		expect(pace.aheadBy).toBe(0);
		expect(pace.perDay).toBeNull();
	});

	test("a future month spreads the whole budget over every day", () => {
		expect(getBudgetPace(getMonthDays(2026, 12, "2026-11-13"), 620, 0).perDay).toBe(20);
	});
});

describe("describeBudgetLeft", () => {
	const nov13 = getMonthDays(2026, 11, "2026-11-13");
	const nov30 = getMonthDays(2026, 11, "2026-11-30");
	const october = getMonthDays(2026, 10, "2026-11-13");

	test("money left and the days to spend it in", () => {
		expect(describeBudgetLeft(getBudgetPace(nov13, 600, 255), fmt)).toEqual({
			text: "$345 left to spend in 18 days",
			tone: "success",
		});
	});

	test("the last day reads today", () => {
		expect(describeBudgetLeft(getBudgetPace(nov30, 200, 170), fmt).text).toBe("$30 left to spend today");
	});

	test("over budget", () => {
		expect(describeBudgetLeft(getBudgetPace(nov13, 200, 215), fmt)).toEqual({
			text: "$15 over · 18 days to go",
			tone: "error",
		});
		expect(describeBudgetLeft(getBudgetPace(nov30, 200, 215), fmt).text).toBe("$15 over · 1 day to go");
	});

	test("budget used exactly", () => {
		expect(describeBudgetLeft(getBudgetPace(nov13, 200, 200), fmt)).toEqual({
			text: "Budget used · 18 days to go",
			tone: "muted",
		});
	});

	test("a plan category counts what's still to contribute", () => {
		expect(describeBudgetLeft(getBudgetPace(nov13, 750, 500), fmt, true)).toEqual({
			text: "$250 to contribute in 18 days",
			tone: "muted",
		});
		expect(describeBudgetLeft(getBudgetPace(nov13, 750, 750), fmt, true).text).toBe("Contributed in full");
	});

	test("a past month says how it ended", () => {
		expect(describeBudgetLeft(getBudgetPace(october, 600, 310), fmt)).toEqual({
			text: "Ended with $290 unspent",
			tone: "success",
		});
		expect(describeBudgetLeft(getBudgetPace(october, 200, 215), fmt)).toEqual({
			text: "$15 over budget",
			tone: "error",
		});
		expect(describeBudgetLeft(getBudgetPace(october, 750, 500), fmt, true).text).toBe("$250 not contributed");
	});
});

describe("describePace", () => {
	const nov13 = getMonthDays(2026, 11, "2026-11-13");

	test("on pace, ahead of pace and over budget", () => {
		expect(describePace(getBudgetPace(nov13, 600, 255), fmt, "November")).toBe("On pace");
		expect(describePace(getBudgetPace(nov13, 200, 150), fmt, "November")).toBe("Ahead of pace by $63");
		expect(describePace(getBudgetPace(nov13, 200, 215), fmt, "November")).toBe("Over budget");
	});

	test("past and future months", () => {
		expect(describePace(getBudgetPace(getMonthDays(2026, 10, "2026-11-13"), 600, 310), fmt, "October")).toBe(
			"52% used"
		);
		expect(describePace(getBudgetPace(getMonthDays(2026, 12, "2026-11-13"), 600, 0), fmt, "December")).toBe(
			"Starts December 1"
		);
	});

	test("a budget used in full", () => {
		expect(describePace(getBudgetPace(nov13, 2000, 2000), fmt, "November")).toBe("100% used");
	});

	test("no budget", () => {
		expect(describePace(getBudgetPace(nov13, 0, 45), fmt, "November")).toBe("No budget set");
	});
});
