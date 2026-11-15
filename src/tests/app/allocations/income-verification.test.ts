import { describe, expect, test } from "bun:test";
import { planIncomeVerification, verifyIncome } from "@/app/allocations/income-verification";

const al = (year: number, month: number, expected_income: number) => ({ year, month, expected_income });
const inc = (amount: number, name = "Pay", notes = "") => ({ amount, name, notes });
const byMonth = (entries: Record<string, ReturnType<typeof inc>[]>) => new Map(Object.entries(entries));

function run(
	allocations: ReturnType<typeof al>[],
	income: Record<string, ReturnType<typeof inc>[]>,
	year = 2026,
	month = 11
) {
	const plan = planIncomeVerification(allocations, year, month);
	return plan ? verifyIncome(plan, byMonth(income)) : { status: "not_set", consecutiveMatches: 0, drift: null };
}

describe("planIncomeVerification", () => {
	test("nothing to verify without a budget or with zero expected income", () => {
		expect(planIncomeVerification([], 2026, 11)).toBeNull();
		expect(planIncomeVerification([al(2026, 11, 0)], 2026, 11)).toBeNull();
	});

	test("lists past months that have a budget, most recent first, within six months", () => {
		const plan = planIncomeVerification(
			[al(2026, 11, 5000), al(2026, 9, 4800), al(2026, 8, 4000), al(2026, 1, 1)],
			2026,
			11
		);
		expect(plan?.months).toEqual([
			{ year: 2026, month: 9, expected: 4800 },
			{ year: 2026, month: 8, expected: 4000 },
		]);
	});

	test("with no budget this month, the latest budget's expected income stands in", () => {
		expect(planIncomeVerification([al(2026, 10, 5000)], 2026, 11)?.months).toEqual([
			{ year: 2026, month: 10, expected: 5000 },
		]);
		expect(planIncomeVerification([al(2026, 10, 0)], 2026, 11)).toBeNull();
	});
});

describe("verifyIncome", () => {
	const all = [al(2026, 11, 5000), al(2026, 10, 5000), al(2026, 9, 5000), al(2026, 8, 5000), al(2026, 7, 4000)];

	test("verified after three or more months within 5% of expected, ignoring transfers", () => {
		const result = run(all, {
			"2026-10": [inc(2500), inc(2500)],
			"2026-9": [inc(4900)],
			"2026-8": [inc(5100), inc(2000, "Transfer from savings"), inc(300, "Gift", "my transfer")],
			"2026-7": [inc(4000)],
		});
		expect(result).toEqual({ status: "verified", consecutiveMatches: 4, drift: null });
	});

	test("a miss stops the count", () => {
		const result = run(all.slice(0, 3), { "2026-10": [inc(2000)], "2026-9": [inc(5000)] });
		expect(result).toEqual({ status: "tracking", consecutiveMatches: 0, drift: null });
	});

	test("income above expected two months running is an increase, suggesting the average", () => {
		const result = run(all.slice(0, 4), {
			"2026-10": [inc(6000)],
			"2026-9": [inc(6500)],
			"2026-8": [inc(5000)],
		});
		expect(result.status).toBe("tracking");
		expect(result.drift).toEqual({ detected: true, direction: "increase", suggestedAmount: 6250, monthsObserved: 2 });
	});

	test("income below expected two months running is a decrease", () => {
		const result = run(all.slice(0, 3), { "2026-10": [inc(4000)], "2026-9": [inc(3000)] });
		expect(result.drift).toEqual({ detected: true, direction: "decrease", suggestedAmount: 3500, monthsObserved: 2 });
	});

	test("a change of direction ends the drift", () => {
		const result = run(all.slice(0, 3), { "2026-10": [inc(6000)], "2026-9": [inc(3000)] });
		expect(result.drift).toBeNull();
	});

	test("a budget with no past months is tracking, not verified", () => {
		expect(run([al(2026, 11, 5000)], {})).toEqual({ status: "tracking", consecutiveMatches: 0, drift: null });
	});
});
