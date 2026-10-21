import { describe, expect, test } from "bun:test";
import {
	buildNetWorthSeries,
	rangeStartDate,
	seriesChange,
	sliceSeries,
	type BalanceAccount,
	type BalanceRecord,
} from "@/app/dashboard/net-worth-series";

const accounts: BalanceAccount[] = [
	{ id: "chq", class: "asset", balance: 1500 },
	{ id: "card", class: "liability", balance: 300 },
];

describe("buildNetWorthSeries", () => {
	test("carries each account's last balance forward and ends on current balances", () => {
		const records: BalanceRecord[] = [
			{ accountId: "chq", date: "2026-10-01", balance: 1000 },
			{ accountId: "card", date: "2026-10-05", balance: 200 },
			{ accountId: "chq", date: "2026-10-10", balance: 1200 },
		];

		const series = buildNetWorthSeries(accounts, records, "2026-10-20");

		// Oct 1: chq 1000, card backfilled to its first record (200) -> 800
		// Oct 5: chq 1000, card 200 -> 800
		// Oct 10: chq 1200, card 200 -> 1000
		// Today: current balances 1500 - 300 -> 1200
		expect(series.map((p) => [p.date, p.value])).toEqual([
			["2026-10-01", 800],
			["2026-10-05", 800],
			["2026-10-10", 1000],
			["2026-10-20", 1200],
		]);
		expect(series[2]).toMatchObject({ assets: 1200, liabilities: 200 });
	});

	test("accounts without history count at their current balance throughout", () => {
		const records: BalanceRecord[] = [{ accountId: "chq", date: "2026-09-01", balance: 900 }];
		const series = buildNetWorthSeries(accounts, records, "2026-10-20");
		expect(series.map((p) => p.value)).toEqual([600, 1200]);
	});

	test("a record dated today is replaced by the current balance", () => {
		const records: BalanceRecord[] = [{ accountId: "chq", date: "2026-10-20", balance: 50 }];
		const series = buildNetWorthSeries(accounts, records, "2026-10-20");
		expect(series).toHaveLength(1);
		expect(series[0].value).toBe(1200);
	});

	test("ignores records for accounts that are no longer active", () => {
		const records: BalanceRecord[] = [{ accountId: "closed", date: "2026-10-02", balance: 99999 }];
		expect(buildNetWorthSeries(accounts, records, "2026-10-20").map((p) => p.value)).toEqual([1200]);
	});

	test("with no accounts the line is flat at zero", () => {
		expect(buildNetWorthSeries([], [], "2026-10-20")).toEqual([
			{ date: "2026-10-20", value: 0, assets: 0, liabilities: 0 },
		]);
	});
});

describe("ranges", () => {
	test("range start goes back whole months from today", () => {
		expect(rangeStartDate("1M", "2026-10-20")).toBe("2026-09-20");
		expect(rangeStartDate("3M", "2026-10-20")).toBe("2026-07-20");
		expect(rangeStartDate("1Y", "2026-10-20")).toBe("2025-10-20");
	});

	test("slicing carries in the value in effect at the range start", () => {
		const series = buildNetWorthSeries(
			accounts,
			[
				{ accountId: "chq", date: "2026-09-01", balance: 1000 },
				{ accountId: "chq", date: "2026-10-01", balance: 1100 },
			],
			"2026-10-20"
		);
		const sliced = sliceSeries(series, "2026-09-20");
		expect(sliced.map((p) => [p.date, p.value])).toEqual([
			["2026-09-20", 700],
			["2026-10-01", 800],
			["2026-10-20", 1200],
		]);
		// 700 -> 1200 is +500, which is 71.43% of 700
		const change = seriesChange(sliced);
		expect(change.amount).toBe(500);
		expect(change.percent).toBeCloseTo(71.4286, 3);
	});

	test("no percent when the starting net worth is zero or negative", () => {
		expect(
			seriesChange([
				{ date: "2026-10-01", value: -200, assets: 0, liabilities: 200 },
				{ date: "2026-10-20", value: 100, assets: 100, liabilities: 0 },
			])
		).toEqual({ amount: 300, percent: null });
	});
});
