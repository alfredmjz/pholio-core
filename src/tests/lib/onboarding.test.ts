import { describe, expect, test } from "bun:test";
import { cleanFullName, needsOnboarding, onboardingPath, safeNextPath } from "@/lib/onboarding";

describe("cleanFullName", () => {
	test("trims and strips angle brackets", () => {
		expect(cleanFullName("  Alex <b>Rivera</b> ")).toEqual({ name: "Alex bRivera/b" });
	});

	test("refuses an empty or overlong name", () => {
		expect(cleanFullName("   ").error).toBe("Enter your name");
		expect(cleanFullName(undefined).error).toBe("Enter your name");
		expect(cleanFullName("a".repeat(256)).error).toBe("Keep your name under 255 characters");
		expect(cleanFullName("a".repeat(255)).name).toHaveLength(255);
	});
});

test("only a signed-in profile without a name needs onboarding", () => {
	expect(needsOnboarding({ full_name: null })).toBe(true);
	expect(needsOnboarding({ full_name: "  " })).toBe(true);
	expect(needsOnboarding({ full_name: "Alex" })).toBe(false);
	expect(needsOnboarding(null)).toBe(false);
});

describe("safeNextPath", () => {
	test("keeps paths on this site", () => {
		expect(safeNextPath("/recurring")).toBe("/recurring");
		expect(safeNextPath("/allocations?year=2026&month=10")).toBe("/allocations?year=2026&month=10");
	});

	test("falls back to the dashboard for anything else", () => {
		expect(safeNextPath(null)).toBe("/dashboard");
		expect(safeNextPath("https://example.com")).toBe("/dashboard");
		expect(safeNextPath("//example.com")).toBe("/dashboard");
		expect(safeNextPath("/\\example.com")).toBe("/dashboard");
	});
});

test("onboarding remembers where to go next", () => {
	expect(onboardingPath("/dashboard")).toBe("/welcome");
	expect(onboardingPath("/recurring")).toBe("/welcome?next=%2Frecurring");
});
