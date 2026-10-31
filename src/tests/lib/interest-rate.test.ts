import { describe, expect, test } from "bun:test";
import { percentInputToRate, rateToPercentInput } from "@/lib/interest-rate";

describe("rateToPercentInput", () => {
	test("shows the stored fraction as a percentage without float noise", () => {
		expect(rateToPercentInput(0.2199)).toBe("21.99");
		expect(rateToPercentInput(0.2499)).toBe("24.99");
		expect(rateToPercentInput(0.045)).toBe("4.5");
		expect(rateToPercentInput(0.055)).toBe("5.5");
		expect(rateToPercentInput(0.07)).toBe("7");
	});

	test("rounds stored drift and extra precision to 2 decimals", () => {
		expect(rateToPercentInput(0.21989999999999998)).toBe("21.99");
		expect(rateToPercentInput(0.12345)).toBe("12.35");
	});

	test("is empty when there is no rate", () => {
		expect(rateToPercentInput(null)).toBe("");
		expect(rateToPercentInput(undefined)).toBe("");
		expect(rateToPercentInput(0)).toBe("");
	});
});

describe("percentInputToRate", () => {
	test("stores the typed percentage as an exact fraction", () => {
		expect(percentInputToRate("21.99")).toBe(0.2199);
		expect(percentInputToRate("19.99")).toBe(0.1999);
		expect(percentInputToRate("4.5")).toBe(0.045);
		expect(percentInputToRate("5.")).toBe(0.05);
		expect(percentInputToRate("0")).toBe(0);
	});

	test("rounds more than 2 decimals", () => {
		expect(percentInputToRate("3.149")).toBe(0.0315);
		expect(percentInputToRate("3.141")).toBe(0.0314);
	});

	test("is null for an empty or invalid entry", () => {
		expect(percentInputToRate("")).toBeNull();
		expect(percentInputToRate(".")).toBeNull();
		expect(percentInputToRate("abc")).toBeNull();
	});

	test("round-trips through the input", () => {
		for (const typed of ["21.99", "0.01", "99.99", "6.25"]) {
			expect(rateToPercentInput(percentInputToRate(typed))).toBe(typed);
		}
	});
});
