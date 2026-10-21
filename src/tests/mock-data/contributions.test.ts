import { describe, expect, test } from "bun:test";
import { getSampleContributionRooms, getSampleContributionSummaries } from "@/mock-data/contributions";

// Demo data must stay time-relative (AGENTS.md §10): every figure is anchored on `now`.
describe("sample contribution data", () => {
	const now = new Date(2026, 9, 20);

	test("the current month has a contribution and year-to-date adds up", () => {
		const [pool] = getSampleContributionSummaries(2026, 10, now);
		expect(pool.month_contributions).toBe(500);
		expect(pool.year_contributions).toBe(5000);
		expect(pool.annual_remaining).toBe(pool.annual_limit! - pool.year_contributions);
		expect(pool.room_remaining).toBe(pool.room_entered! + pool.room_added! - pool.room_used!);
		expect(pool.accounts.reduce((sum, share) => sum + share.month_contributions, 0)).toBe(pool.month_contributions);
	});

	test("future months have no contributions yet", () => {
		expect(getSampleContributionSummaries(2026, 12, now)[0].month_contributions).toBe(0);
		expect(getSampleContributionSummaries(2026, 12, now)[0].year_contributions).toBe(5000);
		expect(getSampleContributionSummaries(2027, 3, now)[0].year_contributions).toBe(0);
	});

	test("past years count every month up to the requested one", () => {
		expect(getSampleContributionSummaries(2025, 6, now)[0].year_contributions).toBe(3000);
	});

	test("the sample room is dated 1 January of the demo year", () => {
		expect(getSampleContributionRooms(now)).toEqual([
			{ plan: "tfsa", room: 25000, room_as_of: "2026-01-01", annual_limit: null },
		]);
	});
});
