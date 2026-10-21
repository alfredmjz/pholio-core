import { describe, expect, test } from "bun:test";
import {
	EMPTY_CONTRIBUTION_ROOM_VALUES,
	startOfCurrentYear,
	toContributionRoomInput,
	toPlanRoomSetting,
	validateContributionRoom,
	withPlanRoom,
	type ContributionRoomFormValues,
} from "@/app/balancesheet/contribution-room-form";
import type { ContributionRoomSetting } from "@/lib/types/contribution";

const form = (overrides: Partial<ContributionRoomFormValues> = {}): ContributionRoomFormValues => ({
	...EMPTY_CONTRIBUTION_ROOM_VALUES,
	track_contribution_room: true,
	...overrides,
});

const TFSA_ROOM: ContributionRoomSetting = { plan: "tfsa", room: 25000, room_as_of: "2026-01-01", annual_limit: null };

describe("startOfCurrentYear", () => {
	test("is 1 January of the given year", () => {
		expect(startOfCurrentYear(new Date(2026, 9, 20))).toBe("2026-01-01");
	});
});

describe("validateContributionRoom", () => {
	test("nothing to validate when tracking is off", () => {
		expect(validateContributionRoom(EMPTY_CONTRIBUTION_ROOM_VALUES)).toBeUndefined();
	});

	test("tracking needs a plan", () => {
		expect(validateContributionRoom(form())).toBe("Choose a plan type, or turn tracking off");
	});

	test("registered plans may leave the shared room blank", () => {
		expect(validateContributionRoom(form({ contribution_plan: "tfsa" }))).toBeUndefined();
	});

	test("Other accounts need their own room (valid_contribution_tracking)", () => {
		expect(validateContributionRoom(form({ contribution_plan: "other" }))).toBe(
			"Enter your available contribution room, or turn tracking off"
		);
		expect(validateContributionRoom(form({ contribution_plan: "other", contribution_room: "  " }))).toBeDefined();
		expect(validateContributionRoom(form({ contribution_plan: "other", contribution_room: "3000" }))).toBeUndefined();
	});
});

describe("withPlanRoom", () => {
	test("prefills the fields from the plan's saved room", () => {
		expect(withPlanRoom(form({ contribution_plan: "tfsa" }), [TFSA_ROOM])).toMatchObject({
			contribution_room: "25000",
			contribution_room_as_of: "2026-01-01",
			annual_contribution_limit: "",
		});
	});

	test("defaults the as-of date to 1 January when the plan has no saved room", () => {
		const values = withPlanRoom(form({ contribution_plan: "rrsp", contribution_room: "99" }), [TFSA_ROOM]);
		expect(values.contribution_room).toBe("");
		expect(values.contribution_room_as_of).toBe(startOfCurrentYear());
	});

	test("leaves Other accounts untouched", () => {
		const values = form({ contribution_plan: "other", contribution_room: "3000" });
		expect(withPlanRoom(values, [TFSA_ROOM])).toBe(values);
	});
});

describe("toContributionRoomInput", () => {
	test("registered plans clear the account's own room columns", () => {
		expect(toContributionRoomInput(form({ contribution_plan: "tfsa", contribution_room: "25000" }))).toEqual({
			track_contribution_room: true,
			contribution_plan: "tfsa",
			contribution_room: null,
			contribution_room_as_of: null,
			annual_contribution_limit: null,
		});
	});

	test("Other accounts store their room, defaulting the as-of date", () => {
		expect(
			toContributionRoomInput(
				form({ contribution_plan: "other", contribution_room: "3000.50", annual_contribution_limit: "1000" })
			)
		).toEqual({
			track_contribution_room: true,
			contribution_plan: "other",
			contribution_room: 3000.5,
			contribution_room_as_of: startOfCurrentYear(),
			annual_contribution_limit: 1000,
		});
	});

	test("keeps an Other account's figures when tracking is switched off", () => {
		const input = toContributionRoomInput(
			form({ track_contribution_room: false, contribution_plan: "other", contribution_room: "3000" })
		);
		expect(input.track_contribution_room).toBe(false);
		expect(input.contribution_room).toBe(3000);
		expect(input.contribution_room_as_of).toBeNull();
	});
});

describe("toPlanRoomSetting", () => {
	test("returns the shared room for tracked registered plans", () => {
		expect(
			toPlanRoomSetting(
				form({ contribution_plan: "fhsa", contribution_room: "8000", contribution_room_as_of: "2026-03-01" })
			)
		).toEqual({ plan: "fhsa", room: 8000, room_as_of: "2026-03-01", annual_limit: null });
	});

	test("blank room is saved as null, as of 1 January", () => {
		expect(toPlanRoomSetting(form({ contribution_plan: "tfsa" }))).toEqual({
			plan: "tfsa",
			room: null,
			room_as_of: startOfCurrentYear(),
			annual_limit: null,
		});
	});

	test("nothing to save for untracked or Other accounts", () => {
		expect(toPlanRoomSetting(form({ track_contribution_room: false, contribution_plan: "tfsa" }))).toBeNull();
		expect(toPlanRoomSetting(form({ contribution_plan: "other", contribution_room: "3000" }))).toBeNull();
	});
});
