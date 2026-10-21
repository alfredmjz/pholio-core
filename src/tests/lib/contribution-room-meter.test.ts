import { describe, expect, test } from "bun:test";
import {
	buildRoomMeter,
	getBudgetProgressPercent,
	getRoomMeterNote,
	getRoomUsedPercent,
} from "@/lib/contribution-room-meter";
import { fmt, makePool } from "../support/contribution-fixtures";

const YEAR = 2026;

describe("buildRoomMeter", () => {
	test("measures this year's annual room when it is smaller than the total room", () => {
		const meter = buildRoomMeter(makePool(), "tfsa", 750, YEAR)!;

		expect(meter.label).toBe("2026 annual TFSA room");
		expect(meter.total).toBe(7000);
		expect(meter.used).toBe(5000);
		expect(meter.left).toBe(2000);
		// $250 of the $750 budget is still to contribute; it is not counted as used.
		expect(meter.leftAfterBudget).toBe(1750);
		expect(meter.cappedByTotal).toBe(false);
		expect(meter.overAnnual).toBe(0);
	});

	test("lowers the annual room to the total room left when that is smaller", () => {
		const pool = makePool({ room_entered: 6000, room_used: 5000, room_remaining: 1000 });
		const meter = buildRoomMeter(pool, "tfsa", 750, YEAR)!;

		expect(meter.cappedByTotal).toBe(true);
		expect(meter.left).toBe(1000);
		// The bar spans what was used plus what can still go in.
		expect(meter.total).toBe(6000);
		expect(meter.leftAfterBudget).toBe(750);
	});

	test("keeps the annual figure when total room equals the annual room left", () => {
		const meter = buildRoomMeter(makePool({ room_remaining: 2000 }), "tfsa", 0, YEAR)!;
		expect(meter.cappedByTotal).toBe(false);
		expect(meter.left).toBe(2000);
	});

	test("reports the amount over the annual limit", () => {
		const pool = makePool({ year_contributions: 8000, annual_remaining: -1000, room_remaining: 17000 });
		const meter = buildRoomMeter(pool, "tfsa", 0, YEAR)!;

		expect(meter.left).toBe(-1000);
		expect(meter.overAnnual).toBe(1000);
		expect(meter.cappedByTotal).toBe(false);
	});

	test("falls back to the total room for plans with no annual limit (RESP)", () => {
		const pool = makePool({
			pool_key: "resp",
			contribution_plan: "resp",
			annual_limit: null,
			annual_limit_source: null,
			annual_remaining: null,
			room_entered: 50000,
			room_used: 12000,
			room_remaining: 38000,
		});
		const meter = buildRoomMeter(pool, "resp", 1000, YEAR)!;

		expect(meter.label).toBe("total RESP room");
		expect(meter.total).toBe(50000);
		expect(meter.used).toBe(12000);
		expect(meter.left).toBe(38000);
		expect(meter.leftAfterBudget).toBe(37500);
	});

	test("includes room CRA added since the as-of date in the total", () => {
		const pool = makePool({
			annual_limit: null,
			annual_remaining: null,
			room_entered: 10000,
			room_added: 9000,
			room_used: 5000,
			room_remaining: 14000,
		});
		expect(buildRoomMeter(pool, "tfsa", 0, YEAR)!.total).toBe(19000);
	});

	test("uses the annual limit on its own when no room was entered", () => {
		const pool = makePool({ room_entered: null, room_added: null, room_used: null, room_remaining: null });
		const meter = buildRoomMeter(pool, "tfsa", 0, YEAR)!;

		expect(meter.label).toBe("2026 annual TFSA room");
		expect(meter.totalLeft).toBeNull();
		expect(meter.left).toBe(2000);
	});

	test("returns null when the pool tracks no room or has no figures", () => {
		expect(buildRoomMeter(makePool({ tracks_room: false }), "tfsa", 0, YEAR)).toBeNull();
		const empty = makePool({
			annual_limit: null,
			annual_remaining: null,
			room_entered: null,
			room_remaining: null,
		});
		expect(buildRoomMeter(empty, "resp", 0, YEAR)).toBeNull();
	});

	test("does not let contributions above the budget raise the room left", () => {
		const pool = makePool({ month_contributions: 900 });
		expect(buildRoomMeter(pool, "tfsa", 750, YEAR)!.leftAfterBudget).toBe(2000);
	});
});

describe("getRoomMeterNote", () => {
	const note = (
		overrides: Parameters<typeof makePool>[0],
		plan: "tfsa" | "rrsp" | "fhsa" | "resp" = "tfsa",
		budget = 0
	) => getRoomMeterNote(buildRoomMeter(makePool(overrides), plan, budget, YEAR)!, plan, YEAR, fmt);

	test("no note when everything fits", () => {
		expect(note({}, "tfsa", 750)).toBeNull();
	});

	test("over the total room is an error, even when the annual room is fine", () => {
		expect(note({ room_remaining: -500 })).toEqual({ level: "over", text: "$500.00 over your total TFSA room" });
	});

	test("TFSA and RRSP above the annual limit are covered by carry-forward room", () => {
		const overrides = { year_contributions: 8000, annual_remaining: -1000, room_remaining: 17000 };
		expect(note(overrides, "tfsa")).toEqual({
			level: "info",
			text: "$1000.00 above the 2026 limit, covered by room from earlier years",
		});
		expect(note({ ...overrides, pool_key: "rrsp", contribution_plan: "rrsp" }, "rrsp")?.level).toBe("info");
	});

	test("FHSA above the annual limit is an error", () => {
		expect(
			note(
				{
					pool_key: "fhsa",
					contribution_plan: "fhsa",
					annual_limit: 8000,
					annual_remaining: -200,
					room_remaining: 7800,
				},
				"fhsa"
			)
		).toEqual({ level: "over", text: "$200.00 over the 2026 FHSA limit" });
	});

	test("warns when the rest of this month's budget does not fit", () => {
		expect(note({}, "tfsa", 3000)).toEqual({
			level: "warning",
			text: "This month's budget is $500.00 more than the room left",
		});
	});

	test("explains when the annual room is limited by the total room", () => {
		expect(note({ room_remaining: 1000 })).toEqual({ level: "info", text: "Limited by your total TFSA room" });
	});

	test("over the total room wins over every other note", () => {
		expect(note({ annual_remaining: -100, room_remaining: -50 }, "tfsa", 9000)?.level).toBe("over");
	});
});

describe("progress percentages", () => {
	test("budget progress is clamped to 0–100", () => {
		expect(getBudgetProgressPercent(500, 750)).toBeCloseTo(66.67, 2);
		expect(getBudgetProgressPercent(900, 750)).toBe(100);
		expect(getBudgetProgressPercent(0, 0)).toBe(0);
		expect(getBudgetProgressPercent(100, 0)).toBe(100);
	});

	test("room used is clamped to 0–100", () => {
		expect(getRoomUsedPercent({ used: 5000, total: 7000 })).toBeCloseTo(71.43, 2);
		expect(getRoomUsedPercent({ used: 8000, total: 7000 })).toBe(100);
		expect(getRoomUsedPercent({ used: 0, total: 0 })).toBe(0);
	});
});
