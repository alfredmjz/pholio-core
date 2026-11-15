import { previousMonthOf } from "@/lib/date-utils";
import type { IncomeVerificationResult } from "./types";

const INCOME_MATCH_TOLERANCE = 0.05; // ±5%
const MONTHS_TO_VERIFY = 3;
const MONTHS_TO_DETECT_DRIFT = 2;
export const MONTHS_TO_LOOK_BACK = 6;

export function noIncomeVerification(): IncomeVerificationResult {
	return { status: "not_set", consecutiveMatches: 0, drift: null };
}

export interface IncomeVerificationPlan {
	/** Past months that have a budget, most recent first: the ones whose income is worth reading. */
	months: Array<{ year: number; month: number; expected: number }>;
}

/**
 * Which past months to check, from the budgets (most recent first). Null when there is no expected
 * income to verify: the current month's (else the latest budget's) is zero.
 */
export function planIncomeVerification(
	allocations: Array<{ year: number; month: number; expected_income: number | string }>,
	currentYear: number,
	currentMonth: number
): IncomeVerificationPlan | null {
	if (allocations.length === 0) return null;

	const expectedByMonth = new Map<string, number>();
	for (const alloc of allocations) {
		expectedByMonth.set(`${alloc.year}-${alloc.month}`, Number(alloc.expected_income));
	}

	const currentExpected =
		expectedByMonth.get(`${currentYear}-${currentMonth}`) ?? Number(allocations[0].expected_income);
	if (currentExpected === 0) return null;

	const months: IncomeVerificationPlan["months"] = [];
	let cursor = { year: currentYear, month: currentMonth };
	for (let i = 0; i < MONTHS_TO_LOOK_BACK; i++) {
		cursor = previousMonthOf(cursor.year, cursor.month);
		const expected = expectedByMonth.get(`${cursor.year}-${cursor.month}`);
		if (expected !== undefined) months.push({ ...cursor, expected });
	}
	return { months };
}

/**
 * Whether income has matched the budget for several months running, and whether it has drifted one
 * way. `incomeByMonth` holds each planned month's positive, non-external transactions by "year-month".
 */
export function verifyIncome(
	plan: IncomeVerificationPlan,
	incomeByMonth: ReadonlyMap<string, Array<{ amount: number | string; name?: string | null; notes?: string | null }>>
): IncomeVerificationResult {
	const monthlyActuals = plan.months.map(({ year, month, expected }) => {
		const actual = (incomeByMonth.get(`${year}-${month}`) || [])
			.filter((t) => {
				const name = (t.name || "").toLowerCase();
				const notes = (t.notes || "").toLowerCase();
				return !name.includes("transfer") && !notes.includes("transfer");
			})
			.reduce((sum, t) => sum + Number(t.amount), 0);
		return { actual, expected };
	});

	if (monthlyActuals.length === 0) return { ...noIncomeVerification(), status: "tracking" };

	// Verification: consecutive months where actual ≈ expected (within tolerance)
	let consecutiveMatches = 0;
	for (const entry of monthlyActuals) {
		if (entry.expected === 0) break;
		const ratio = entry.actual / entry.expected;
		if (ratio >= 1 - INCOME_MATCH_TOLERANCE && ratio <= 1 + INCOME_MATCH_TOLERANCE) {
			consecutiveMatches++;
		} else {
			break;
		}
	}

	const status = consecutiveMatches >= MONTHS_TO_VERIFY ? "verified" : "tracking";

	// Drift: recent actual income consistently above or below expected, in one direction.
	let drift: IncomeVerificationResult["drift"] = null;

	if (monthlyActuals.length >= MONTHS_TO_DETECT_DRIFT) {
		let driftMonths = 0;
		let driftDirection: "increase" | "decrease" | null = null;
		let driftSum = 0;

		for (const entry of monthlyActuals) {
			if (entry.expected === 0 || entry.actual === 0) break;
			const ratio = entry.actual / entry.expected;

			if (ratio > 1 + INCOME_MATCH_TOLERANCE) {
				if (driftDirection === "decrease") break;
				driftDirection = "increase";
				driftMonths++;
				driftSum += entry.actual;
			} else if (ratio < 1 - INCOME_MATCH_TOLERANCE) {
				if (driftDirection === "increase") break;
				driftDirection = "decrease";
				driftMonths++;
				driftSum += entry.actual;
			} else {
				break;
			}
		}

		if (driftMonths >= MONTHS_TO_DETECT_DRIFT && driftDirection) {
			drift = {
				detected: true,
				direction: driftDirection,
				suggestedAmount: Math.round(driftSum / driftMonths),
				monthsObserved: driftMonths,
			};
		}
	}

	return { status, consecutiveMatches, drift };
}
