import { describe, expect, test } from "bun:test";
import { computeMonthPace } from "@/app/dashboard/month-pace";

// October 2026 has 31 days.
const base = { year: 2026, month: 10, budget: 3100 };

describe("computeMonthPace", () => {
	test("even pace: expected spend grows by budget / days", () => {
		const pace = computeMonthPace({
			...base,
			today: "2026-10-10",
			expenses: [
				{ date: "2026-10-02", amount: 400 },
				{ date: "2026-10-09", amount: 600 },
			],
		});

		// 3100 / 31 = 100 per day, so 1000 expected by day 10; 1000 spent.
		expect(pace.expectedByToday).toBe(1000);
		expect(pace.spent).toBe(1000);
		expect(pace.difference).toBe(0);
		expect(pace.status).toBe("on_pace");
		expect(pace.daysLeft).toBe(21);
		expect(pace.remaining).toBe(2100);
		// 2100 left across today plus 21 more days = 22 days
		expect(pace.dailyAllowance).toBe(95.45);
		expect(pace.cumulative).toHaveLength(10);
		expect(pace.cumulative[1]).toBe(400);
		expect(pace.expected).toHaveLength(31);
		expect(pace.usesTypicalCurve).toBe(false);
	});

	test("ignores spending after today and outside the month", () => {
		const pace = computeMonthPace({
			...base,
			today: "2026-10-10",
			expenses: [
				{ date: "2026-09-30", amount: 999 },
				{ date: "2026-10-05T00:00:00.000Z", amount: 50 },
				{ date: "2026-10-22", amount: 999 },
			],
		});
		expect(pace.spent).toBe(50);
	});

	test("more than 5% of budget ahead is over pace; behind is under", () => {
		const ahead = computeMonthPace({ ...base, today: "2026-10-10", expenses: [{ date: "2026-10-01", amount: 1156 }] });
		// 1156 - 1000 = 156, more than 5% of 3100 (155)
		expect(ahead.status).toBe("over_pace");

		const edge = computeMonthPace({ ...base, today: "2026-10-10", expenses: [{ date: "2026-10-01", amount: 1155 }] });
		expect(edge.status).toBe("on_pace");

		const behind = computeMonthPace({ ...base, today: "2026-10-10", expenses: [{ date: "2026-10-01", amount: 500 }] });
		expect(behind.status).toBe("under");
	});

	test("over budget wins over pace, and nothing remains", () => {
		const pace = computeMonthPace({ ...base, today: "2026-10-28", expenses: [{ date: "2026-10-01", amount: 3200 }] });
		expect(pace.status).toBe("over_budget");
		expect(pace.remaining).toBe(0);
		expect(pace.dailyAllowance).toBe(0);
	});

	test("no budget", () => {
		const pace = computeMonthPace({ ...base, budget: 0, today: "2026-10-10", expenses: [] });
		expect(pace.status).toBe("no_budget");
	});

	test("a typical spending curve is scaled to this month's budget", () => {
		// Past months front-loaded: half of all spending by day 1 (rent), then even.
		const curve = Array.from({ length: 31 }, (_, i) => 1000 + (1000 * i) / 30);
		const pace = computeMonthPace({
			...base,
			today: "2026-10-01",
			typicalCurve: curve,
			expenses: [{ date: "2026-10-01", amount: 1550 }],
		});
		// Day 1 is 1000 of a 2000 month-end total: 50% of 3100 = 1550.
		expect(pace.usesTypicalCurve).toBe(true);
		expect(pace.expectedByToday).toBe(1550);
		expect(pace.expected[30]).toBe(3100);
		expect(pace.status).toBe("on_pace");
	});

	test("a curve that is too short falls back to even pace", () => {
		const pace = computeMonthPace({ ...base, today: "2026-10-10", typicalCurve: [10, 20], expenses: [] });
		expect(pace.usesTypicalCurve).toBe(false);
		expect(pace.expectedByToday).toBe(1000);
	});

	test("a past month is measured at its last day", () => {
		const pace = computeMonthPace({ ...base, today: "2026-11-03", expenses: [{ date: "2026-10-31", amount: 10 }] });
		expect(pace.dayOfMonth).toBe(31);
		expect(pace.daysLeft).toBe(0);
		expect(pace.spent).toBe(10);
	});
});
