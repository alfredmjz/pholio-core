import { describe, expect, test } from "bun:test";
import { interestEarned, monthlyInterest } from "@/lib/interest";
import { overdraftInterest } from "@/lib/overdraft";

describe("monthlyInterest", () => {
	test("a twelfth of the yearly rate on the balance, rounded to cents", () => {
		// 3,200 x 1.75% / 12 = 4.6666...
		expect(monthlyInterest(3200, 0.0175)).toBe(4.67);
		// 1,000 x 2.19% / 12 = 1.825, rounds half up
		expect(monthlyInterest(1000, 0.0219)).toBe(1.83);
		expect(monthlyInterest(8500, 0.045)).toBe(31.88);
	});

	test("accepts the numeric strings Postgres decimals can arrive as", () => {
		expect(monthlyInterest("3200.00", "0.0175")).toBe(4.67);
	});

	test("no rate, a zero rate or a negative rate earns nothing", () => {
		expect(monthlyInterest(3200, null)).toBe(0);
		expect(monthlyInterest(3200, undefined)).toBe(0);
		expect(monthlyInterest(3200, 0)).toBe(0);
		expect(monthlyInterest(3200, -0.02)).toBe(0);
	});

	test("an empty or overdrawn account earns no deposit interest", () => {
		expect(monthlyInterest(0, 0.0175)).toBe(0);
		expect(monthlyInterest(-250, 0.0175)).toBe(0);
	});

	test("an overdrawn chequing account with both rates pays only overdraft interest", () => {
		const balance = -600;
		expect(monthlyInterest(balance, 0.0175)).toBe(0);
		// 600 x 21.99% / 12 = 10.995
		expect(overdraftInterest(balance, 0.2199)).toBe(-11);
	});
});

describe("interestEarned", () => {
	test("adds the interest paid in and leaves out overdraft interest and other rows", () => {
		const rows = [
			{ transaction_type: "interest", amount: 3.82 },
			{ transaction_type: "interest", amount: 4.1 },
			{ transaction_type: "interest", amount: -11 },
			{ transaction_type: "deposit", amount: 2400 },
		];
		expect(interestEarned(rows)).toBe(7.92);
	});

	test("zero with no interest rows", () => {
		expect(interestEarned([])).toBe(0);
	});
});
