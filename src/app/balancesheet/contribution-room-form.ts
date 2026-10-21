// Pure helpers for the contribution-room fields of the Add/Edit Account dialogs
// (ContributionRoomFields). Kept free of React so they can be unit tested.
//
// CRA reports contribution room as of 1 January, so the "as of" date is never typed in: it is
// set to 1 January of the year in which the user enters (or changes) the room figure. The
// annual limit of a registered plan always comes from CRA's published limits; only "Other"
// accounts, which have no CRA limit, take an annual figure from the user.

import { isRegisteredPlan } from "@/lib/contribution-plans";
import type { ContributionPlan, CreateAccountInput } from "./types";
import type { ContributionRoomSetting } from "@/lib/types/contribution";

export interface ContributionRoomFormValues {
	track_contribution_room: boolean;
	contribution_plan: ContributionPlan | "";
	contribution_room: string;
	/** Set automatically from the year the room figure was entered; not an input. */
	contribution_room_as_of: string;
	/** Only used by "Other" accounts. */
	annual_contribution_limit: string;
}

export const EMPTY_CONTRIBUTION_ROOM_VALUES: ContributionRoomFormValues = {
	track_contribution_room: false,
	contribution_plan: "",
	contribution_room: "",
	contribution_room_as_of: "",
	annual_contribution_limit: "",
};

/** CRA My Account reports room as of 1 January, so that is the "as of" date. */
export function startOfCurrentYear(now: Date = new Date()): string {
	return `${now.getFullYear()}-01-01`;
}

const toFieldValue = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
const toAmount = (value: string) => (value ? parseFloat(value) : null);

/** The year the room figure was entered for, or null when none is set. */
export function getRoomYear(values: Pick<ContributionRoomFormValues, "contribution_room_as_of">): number | null {
	const year = parseInt(values.contribution_room_as_of.slice(0, 4), 10);
	return Number.isNaN(year) ? null : year;
}

/** Changes made when the user edits the room: a new figure is CRA's figure for this year. */
export function withRoomChange(room: string, now: Date = new Date()): Partial<ContributionRoomFormValues> {
	return { contribution_room: room, contribution_room_as_of: startOfCurrentYear(now) };
}

/** Fills the room fields from the plan's shared room, if the user has saved one. */
export function withPlanRoom(
	values: ContributionRoomFormValues,
	planRooms: ContributionRoomSetting[]
): ContributionRoomFormValues {
	if (!isRegisteredPlan(values.contribution_plan)) return values;
	const setting = planRooms.find((room) => room.plan === values.contribution_plan);
	return {
		...values,
		contribution_room: toFieldValue(setting?.room),
		contribution_room_as_of: setting?.room_as_of ?? startOfCurrentYear(),
		annual_contribution_limit: "",
	};
}

export function validateContributionRoom(values: ContributionRoomFormValues): string | undefined {
	if (!values.track_contribution_room) return undefined;
	if (!values.contribution_plan) return "Choose a plan type, or turn tracking off";
	// Accounts outside the registered plans keep their own room (valid_contribution_tracking).
	if (!isRegisteredPlan(values.contribution_plan) && !values.contribution_room.trim()) {
		return "Enter your available contribution room, or turn tracking off";
	}
	return undefined;
}

/**
 * Maps the form onto the account columns. Registered plans keep their room in the shared
 * plan room (see toPlanRoomSetting), so the account columns are cleared for them.
 */
export function toContributionRoomInput(
	values: ContributionRoomFormValues
): Pick<
	CreateAccountInput,
	| "track_contribution_room"
	| "contribution_plan"
	| "contribution_room"
	| "contribution_room_as_of"
	| "annual_contribution_limit"
> {
	if (isRegisteredPlan(values.contribution_plan)) {
		return {
			track_contribution_room: values.track_contribution_room,
			contribution_plan: values.contribution_plan,
			contribution_room: null,
			contribution_room_as_of: null,
			annual_contribution_limit: null,
		};
	}
	// Figures are kept when tracking is switched off so turning it back on restores them.
	return {
		track_contribution_room: values.track_contribution_room,
		contribution_plan: values.contribution_plan || null,
		contribution_room: toAmount(values.contribution_room),
		contribution_room_as_of:
			values.contribution_room_as_of || (values.track_contribution_room ? startOfCurrentYear() : null),
		annual_contribution_limit: toAmount(values.annual_contribution_limit),
	};
}

/**
 * The shared plan room to save, for tracked accounts of a registered plan. Returns null when
 * the figure is unchanged, so saving other account details never re-dates last year's room
 * (which would stop TFSA room from rolling forward correctly).
 */
export function toPlanRoomSetting(
	values: ContributionRoomFormValues,
	planRooms: ContributionRoomSetting[] = []
): ContributionRoomSetting | null {
	if (!values.track_contribution_room || !isRegisteredPlan(values.contribution_plan)) return null;

	const room = toAmount(values.contribution_room);
	const roomAsOf = values.contribution_room_as_of || startOfCurrentYear();
	const saved = planRooms.find((setting) => setting.plan === values.contribution_plan);
	if (saved && saved.room === room && saved.room_as_of === roomAsOf) return null;

	return { plan: values.contribution_plan, room, room_as_of: roomAsOf, annual_limit: null };
}
