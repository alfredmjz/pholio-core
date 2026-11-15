import { describe, expect, test } from "bun:test";
import { allocationsWithBudget, buildHistoricalPace } from "@/app/allocations/historical-pace";

const spend = (count: number, amount: number, date: string) =>
	Array.from({ length: count }, () => ({ amount, transaction_date: date }));

describe("allocationsWithBudget", () => {
	test("sums each month's category caps and drops months without a budget", () => {
		const result = allocationsWithBudget(
			[
				{ id: "a10", year: 2026, month: 10 },
				{ id: "a09", year: 2026, month: 9 },
				{ id: "a08", year: 2026, month: 8 },
			],
			[
				{ allocation_id: "a10", budget_cap: "600" },
				{ allocation_id: "a10", budget_cap: 400 },
				{ allocation_id: "a09", budget_cap: 500 },
				{ allocation_id: "a08", budget_cap: 0 },
			]
		);
		expect(result.map((r) => [r.id, r.budget])).toEqual([
			["a10", 1000],
			["a09", 500],
		]);
	});
});

describe("buildHistoricalPace", () => {
	test("averages each month's running total by day of month", () => {
		const months = [
			{ year: 2026, month: 10 },
			{ year: 2026, month: 9 },
		];
		const expenses = [
			...spend(10, -10, "2026-10-01"),
			...spend(1, -50, "2026-10-31"),
			...spend(1, -200, "2026-09-15"),
			...spend(1, -100, "2026-09-30"),
		];
		const pace = buildHistoricalPace(months, expenses, 2026, 11);
		expect(pace.hasEnoughData).toBe(true);
		expect(pace.dailyAmounts).toHaveLength(31);
		// Oct runs 100 then 150 on day 31; Sep runs 0, 200 from day 15, 300 from day 30.
		expect(pace.dailyAmounts[0]).toBe(50);
		expect(pace.dailyAmounts[13]).toBe(50);
		expect(pace.dailyAmounts[14]).toBe(150);
		expect(pace.dailyAmounts[28]).toBe(150);
		expect(pace.dailyAmounts[29]).toBe(200);
		// Only October has a 31st day.
		expect(pace.dailyAmounts[30]).toBe(150);
	});

	test("a day no month has carries the last known amount", () => {
		const pace = buildHistoricalPace([{ year: 2026, month: 11 }], spend(11, -10, "2026-11-05"), 2026, 12);
		expect(pace.dailyAmounts.slice(0, 5)).toEqual([0, 0, 0, 0, 110]);
		expect(pace.dailyAmounts[29]).toBe(110);
		expect(pace.dailyAmounts[30]).toBe(110);
	});

	test("needs more than 10 expenses in the month just before", () => {
		const months = [{ year: 2026, month: 10 }];
		expect(buildHistoricalPace(months, spend(10, -10, "2026-10-05"), 2026, 11)).toEqual({
			hasEnoughData: false,
			dailyAmounts: [],
		});
		expect(buildHistoricalPace(months, spend(11, -10, "2026-10-05"), 2026, 11).hasEnoughData).toBe(true);
		expect(buildHistoricalPace(months, spend(20, -10, "2026-10-05"), 2026, 12).hasEnoughData).toBe(false);
	});

	test("rolls back over the year boundary", () => {
		const pace = buildHistoricalPace([{ year: 2025, month: 12 }], spend(11, -10, "2025-12-02"), 2026, 1);
		expect(pace.hasEnoughData).toBe(true);
	});
});
