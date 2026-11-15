import { describe, expect, test } from "bun:test";
import { validateContributedOverride } from "@/lib/contributed-override";

const TODAY = "2026-11-15";

describe("validateContributedOverride", () => {
	test("a blank amount clears the figure", () => {
		expect(validateContributedOverride("  ", "2026-06-30", TODAY)).toEqual({ ok: true, amount: null, asOf: null });
	});

	test("a valid figure keeps its cents and date", () => {
		expect(validateContributedOverride("4000.5", "2026-06-30", TODAY)).toEqual({
			ok: true,
			amount: 4000.5,
			asOf: "2026-06-30",
		});
		expect(validateContributedOverride("0", TODAY, TODAY)).toEqual({ ok: true, amount: 0, asOf: TODAY });
	});

	test("rejects bad amounts and dates", () => {
		expect(validateContributedOverride("abc", "2026-06-30", TODAY)).toEqual({
			ok: false,
			error: "Enter a valid amount.",
		});
		expect(validateContributedOverride("-5", "2026-06-30", TODAY)).toEqual({
			ok: false,
			error: "Amount can't be negative.",
		});
		expect(validateContributedOverride("100", "", TODAY)).toEqual({
			ok: false,
			error: "Pick the date this figure runs up to.",
		});
		expect(validateContributedOverride("100", "2026-11-16", TODAY)).toEqual({
			ok: false,
			error: "The date can't be in the future.",
		});
		expect(validateContributedOverride("100", "2025-12-31", TODAY)).toEqual({
			ok: false,
			error: "Pick a date in this year.",
		});
	});
});
