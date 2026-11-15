import { afterEach, describe, expect, test } from "bun:test";
import { buildSampleTransactions, getSmartMockData, sampleAllocationSummary } from "@/mock-data/allocations";

const original = process.env.DEMO_DATE;
afterEach(() => {
	if (original === undefined) delete process.env.DEMO_DATE;
	else process.env.DEMO_DATE = original;
});

describe("allocations demo data", () => {
	test("the sample budget sits in the demo month and follows DEMO_DATE", () => {
		process.env.DEMO_DATE = "2027-04-15";
		expect(sampleAllocationSummary.allocation.year).toBe(2027);
		expect(sampleAllocationSummary.allocation.month).toBe(4);
		process.env.DEMO_DATE = "2031-11-02";
		expect(sampleAllocationSummary.allocation.year).toBe(2031);
		expect(sampleAllocationSummary.allocation.month).toBe(11);
	});

	test("every month near the demo date is populated, with no calendar-fixed special months", () => {
		process.env.DEMO_DATE = "2027-04-15";
		for (const [year, month] of [
			[2027, 3],
			[2027, 4],
			[2027, 5],
		]) {
			expect(getSmartMockData(year, month).transactions.length).toBeGreaterThan(0);
		}
	});

	test("timestamps come from the demo date, not module load", () => {
		const now = new Date(2030, 5, 10);
		const [first] = buildSampleTransactions(2030, 6, now);
		expect(first.created_at).toBe(now.toISOString());
	});
});
