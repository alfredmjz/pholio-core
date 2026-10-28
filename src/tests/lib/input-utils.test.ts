import { describe, expect, test } from "bun:test";
import {
	sanitizeDecimalInput,
	sanitizeIntegerInput,
	sanitizePositiveIntegerInput,
	validateDecimalInput,
} from "@/lib/input-utils";

describe("sanitizeDecimalInput", () => {
	test("strips leading zeros from the whole-number part", () => {
		expect(sanitizeDecimalInput("04")).toBe("4");
		expect(sanitizeDecimalInput("0040")).toBe("40");
		expect(sanitizeDecimalInput("007.5")).toBe("7.5");
		expect(sanitizeDecimalInput("00.5")).toBe("0.5");
	});

	test("keeps a single zero and amounts below one", () => {
		expect(sanitizeDecimalInput("0")).toBe("0");
		expect(sanitizeDecimalInput("00")).toBe("0");
		expect(sanitizeDecimalInput("0.")).toBe("0.");
		expect(sanitizeDecimalInput("0.05")).toBe("0.05");
		expect(sanitizeDecimalInput(".5")).toBe(".5");
	});

	test("keeps zeros that are not leading", () => {
		expect(sanitizeDecimalInput("100")).toBe("100");
		expect(sanitizeDecimalInput("1000.50")).toBe("1000.50");
	});

	test("removes other characters, extra dots and extra decimals", () => {
		expect(sanitizeDecimalInput("$1,234.567")).toBe("1234.56");
		expect(sanitizeDecimalInput("1.2.3")).toBe("1.23");
		expect(sanitizeDecimalInput("abc")).toBe("");
		expect(sanitizeDecimalInput("")).toBe("");
		expect(sanitizeDecimalInput("12.345", 3)).toBe("12.345");
	});
});

describe("sanitizeIntegerInput", () => {
	test("keeps digits only, without leading zeros", () => {
		expect(sanitizeIntegerInput("04")).toBe("4");
		expect(sanitizeIntegerInput("0")).toBe("0");
		expect(sanitizeIntegerInput("1a2")).toBe("12");
		expect(sanitizeIntegerInput("120")).toBe("120");
	});
});

describe("sanitizePositiveIntegerInput", () => {
	test("drops leading zeros and a lone zero", () => {
		expect(sanitizePositiveIntegerInput("02")).toBe("2");
		expect(sanitizePositiveIntegerInput("0")).toBe("");
		expect(sanitizePositiveIntegerInput("00")).toBe("");
		expect(sanitizePositiveIntegerInput("10")).toBe("10");
		expect(sanitizePositiveIntegerInput("3w")).toBe("3");
	});
});

describe("validateDecimalInput", () => {
	test("rejects leading zeros", () => {
		expect(validateDecimalInput("04")).toBe(false);
		expect(validateDecimalInput("00.5")).toBe(false);
	});

	test("accepts valid amounts", () => {
		for (const value of ["", "0", "0.", "0.5", ".5", "4", "40", "1234.56", "10."]) {
			expect(validateDecimalInput(value)).toBe(true);
		}
	});

	test("rejects too many decimals and stray characters", () => {
		expect(validateDecimalInput("1.234")).toBe(false);
		expect(validateDecimalInput("1a")).toBe(false);
	});
});
