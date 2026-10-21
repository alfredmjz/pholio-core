// Pure helpers for the contribution-room fields of the Add/Edit Account dialogs
// (ContributionRoomFields). Kept free of React so they can be unit tested.

import { isRegisteredPlan } from "@/lib/contribution-plans";
import type { ContributionPlan, CreateAccountInput } from "./types";
import type { ContributionRoomSetting } from "@/lib/types/contribution";

export interface ContributionRoomFormValues {
	track_contribution_room: boolean;
	contribution_plan: ContributionPlan | "";
	contribution_room: string;
	contribution_room_as_of: string;
	annual_contribution_limit: string;
}

export const EMPTY_CONTRIBUTION_ROOM_VALUES: ContributionRoomFormValues = {
	track_contribution_room: false,
	contribution_plan: "",
	contribution_room: "",
	contribution_room_as_of: "",
	annual_contribution_limit: "",
};

/** CRA My Account reports TFSA room as of 1 January, so that is the default "as of" date. */
export function startOfCurrentYear(now: Date = new Date()): string {
	return `${now.getFullYear()}-01-01`;
}

const toFieldValue = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
const toAmount = (value: string) => (value ? parseFloat(value) : null);

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
		annual_contribution_limit: toFieldValue(setting?.annual_limit),
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

/** The shared plan room to save, for tracked accounts of a registered plan. */
export function toPlanRoomSetting(values: ContributionRoomFormValues): ContributionRoomSetting | null {
	if (!values.track_contribution_room || !isRegisteredPlan(values.contribution_plan)) return null;
	return {
		plan: values.contribution_plan,
		room: toAmount(values.contribution_room),
		room_as_of: values.contribution_room_as_of || startOfCurrentYear(),
		annual_limit: toAmount(values.annual_contribution_limit),
	};
}
