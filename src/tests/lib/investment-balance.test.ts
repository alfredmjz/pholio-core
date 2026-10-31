import { describe, expect, test } from "bun:test";
import { summarizeInvestmentFlows } from "@/lib/investment-balance";

describe("summarizeInvestmentFlows", () => {
	test("deposits, transfers in and contributions add up; withdrawals and transfers out come off", () => {
		// 500 + 1,200.50 + 250 in; 300 + 49.99 out.
		const flows = summarizeInvestmentFlows([
			{ amount: 500 },
			{ amount: 1200.5 },
			{ amount: 250 },
			{ amount: -300 },
			{ amount: -49.99 },
		]);
		expect(flows).toEqual({ deposited: 1950.5, withdrawn: 349.99, net: 1600.51 });
	});

	test("an opening amount plus the net is the amount deposited", () => {
		const opening = 10000;
		const { net } = summarizeInvestmentFlows([{ amount: 2500 }, { amount: -1000 }]);
		expect(opening + net).toBe(11500);
	});

	test("cents don't drift", () => {
		// 0.1 + 0.2 is 0.30000000000000004 in floats.
		expect(summarizeInvestmentFlows([{ amount: 0.1 }, { amount: 0.2 }]).deposited).toBe(0.3);
	});

	test("no rows", () => {
		expect(summarizeInvestmentFlows([])).toEqual({ deposited: 0, withdrawn: 0, net: 0 });
	});
});
