import { describe, expect, test } from "bun:test";
import { inferPaySchedule, type IncomeDeposit } from "@/lib/paycheck";

// A Friday.
const today = "2026-10-23";

const deposits = (amount: number, ...dates: string[]): IncomeDeposit[] => dates.map((date) => ({ date, amount }));

describe("inferPaySchedule", () => {
	test("weekly pay due today but not yet recorded makes today the payday", () => {
		expect(inferPaySchedule(deposits(800, "2026-10-02", "2026-10-09", "2026-10-16"), today)).toEqual({
			cadence: "weekly",
			nextPayday: "2026-10-23",
		});
	});

	test("weekly pay already recorded today moves on a week", () => {
		const schedule = inferPaySchedule(deposits(800, "2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23"), today);
		expect(schedule.nextPayday).toBe("2026-10-30");
	});

	test("biweekly pay lands on the same weekday", () => {
		expect(inferPaySchedule(deposits(2100, "2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16"), today)).toEqual({
			cadence: "biweekly",
			nextPayday: "2026-10-30",
		});
	});

	test("a one-off sale counts as income but does not set the rhythm", () => {
		const withSale = [
			...deposits(2100, "2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16"),
			...deposits(9000, "2026-10-10"),
		];
		expect(inferPaySchedule(withSale, today)).toEqual({ cadence: "biweekly", nextPayday: "2026-10-30" });
	});

	test("semi-monthly pay follows the two dates of the month", () => {
		const pay = deposits(2000, "2026-08-15", "2026-08-31", "2026-09-15", "2026-09-30", "2026-10-15");
		expect(inferPaySchedule(pay, today)).toEqual({ cadence: "semimonthly", nextPayday: "2026-10-30" });
	});

	test("monthly pay repeats on the same day", () => {
		expect(inferPaySchedule(deposits(4000, "2026-07-28", "2026-08-28", "2026-09-28"), today)).toEqual({
			cadence: "monthly",
			nextPayday: "2026-10-28",
		});
	});

	test("two weeks across the end of daylight saving are still fourteen days", () => {
		expect(inferPaySchedule(deposits(2100, "2026-10-16", "2026-10-30", "2026-11-13"), "2026-11-20")).toEqual({
			cadence: "biweekly",
			nextPayday: "2026-11-27",
		});
	});

	test("irregular income falls back to the first of next month", () => {
		expect(inferPaySchedule(deposits(1000, "2026-07-03", "2026-08-20", "2026-09-09"), today)).toEqual({
			cadence: null,
			nextPayday: "2026-11-01",
		});
	});

	test("fewer than three deposits, or only old ones, fall back too", () => {
		expect(inferPaySchedule(deposits(1000, "2026-09-15", "2026-10-15"), today).cadence).toBeNull();
		expect(inferPaySchedule(deposits(1000, "2026-05-01", "2026-06-01", "2026-09-01"), today)).toEqual({
			cadence: null,
			nextPayday: "2026-11-01",
		});
	});
});
