import { describe, expect, test } from "bun:test";
import { formatRelativeTime } from "@/lib/date-utils";

describe("formatRelativeTime", () => {
	const now = new Date(2026, 9, 25, 12, 0, 0).getTime();
	const ago = (ms: number) => new Date(now - ms).toISOString();

	test("measures from the given moment, not the device clock", () => {
		expect(formatRelativeTime(ago(59_999), now)).toBe("Just now");
		expect(formatRelativeTime(ago(59_999), now + 1)).toBe("1m ago");
	});

	test("steps through minutes, hours and days", () => {
		expect(formatRelativeTime(ago(3 * 60_000), now)).toBe("3m ago");
		expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
		expect(formatRelativeTime(ago(30 * 3_600_000), now)).toBe("Yesterday");
		expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3d ago");
	});
});
