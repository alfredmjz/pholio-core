import { describe, expect, test } from "bun:test";
import { buildMonthlyCashflow, cashflowWindowStart } from "@/app/dashboard/cashflow";

describe("buildMonthlyCashflow", () => {
	test("returns every month in the window, oldest first, including empty months", () => {
		const months = buildMonthlyCashflow([], "2026-02-14", 4);
		expect(months.map((m) => [m.key, m.label])).toEqual([
			["2025-11", "Nov"],
			["2025-12", "Dec"],
			["2026-01", "Jan"],
			["2026-02", "Feb"],
		]);
		expect(months.every((m) => m.income === 0 && m.expenses === 0 && m.net === 0)).toBe(true);
	});

	test("sums income and spending per month and leaves transfers out", () => {
		const months = buildMonthlyCashflow(
			[
				{ date: "2026-10-01", amount: 2500 },
				{ date: "2026-10-03", amount: -120.1 },
				{ date: "2026-10-04", amount: -79.9 },
				{ date: "2026-10-05", amount: -500, source: "transfer" },
				{ date: "2026-10-05", amount: 500, source: "transfer" },
				{ date: "2026-09-15T12:00:00.000Z", amount: -40 },
				{ date: "2026-03-01", amount: 999 },
			],
			"2026-10-20",
			2
		);
		expect(months).toEqual([
			{ key: "2026-09", label: "Sep", income: 0, expenses: 40, net: -40 },
			{ key: "2026-10", label: "Oct", income: 2500, expenses: 200, net: 2300 },
		]);
	});

	test("a transaction is a transfer by its source, not its name", () => {
		const [month] = buildMonthlyCashflow([{ date: "2026-10-02", amount: 300, source: "manual" }], "2026-10-20", 1);
		expect(month.income).toBe(300);
	});

	test("window start is the first of the oldest month", () => {
		expect(cashflowWindowStart("2026-10-20", 6)).toBe("2026-05-01");
		expect(cashflowWindowStart("2026-02-28", 3)).toBe("2025-12-01");
	});
});
