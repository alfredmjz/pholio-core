import { estimateMonthlyOverContributionTax, getContributionPlanLabel, getRoomTerm } from "@/lib/contribution-plans";
import type { RegisteredPlan } from "@/app/balancesheet/types";
import type { ContributionSummary } from "@/lib/types/contribution";

/**
 * Pure model behind the Allocations contribution-room meter (ContributionRoomMeter).
 * It only chooses and compares figures already derived by get_contribution_summaries().
 */
export interface RoomMeterModel {
	/** Which figure is measured, in lower case: "2026 annual TFSA room" or "total TFSA contribution room". */
	label: string;
	/** Room available this period: the annual limit, or less when the total room is smaller. */
	total: number;
	/** Room already used by real contributions this period. */
	used: number;
	/** Room left after real contributions (negative = over). */
	left: number;
	/** Room left if the rest of this month's budget is contributed. */
	leftAfterBudget: number;
	/** The annual room was lowered to the total room left (`totalLeft`). */
	cappedByTotal: boolean;
	totalLeft: number | null;
	/** Amount over this year's annual limit (0 when within it). */
	overAnnual: number;
}

/**
 * Allocations measures against this year's annual room. When the total (lifetime) room left is
 * smaller than what is left of the annual limit, the annual room shrinks to the total room
 * left, since that is all that can still be contributed. Plans without an annual limit (RESP)
 * use the total room; with no room entered, the annual limit is used on its own. Only real
 * contributions (from the database) use room. Returns null when the pool has neither figure.
 */
export function buildRoomMeter(
	pool: ContributionSummary,
	plan: RegisteredPlan,
	budget: number,
	year: number
): RoomMeterModel | null {
	if (!pool.tracks_room) return null;

	const planLabel = getContributionPlanLabel(plan);
	const stillBudgeted = Math.max(0, budget - pool.month_contributions);
	const totalLeft = pool.room_remaining;

	if (pool.annual_limit !== null && pool.annual_remaining !== null) {
		const annualLeft = pool.annual_remaining;
		const cappedByTotal = totalLeft !== null && totalLeft < annualLeft;
		const left = cappedByTotal ? totalLeft : annualLeft;
		const used = pool.year_contributions;
		return {
			label: `${year} annual ${planLabel} room`,
			total: cappedByTotal ? used + Math.max(0, left) : pool.annual_limit,
			used,
			left,
			leftAfterBudget: left - stillBudgeted,
			cappedByTotal,
			totalLeft,
			overAnnual: Math.max(0, -annualLeft),
		};
	}

	if (totalLeft !== null) {
		return {
			label: `total ${getRoomTerm(plan)}`,
			total: (pool.room_entered ?? 0) + (pool.room_added ?? 0),
			used: pool.room_used ?? 0,
			left: totalLeft,
			leftAfterBudget: totalLeft - stillBudgeted,
			cappedByTotal: false,
			totalLeft,
			overAnnual: 0,
		};
	}

	return null;
}

export type RoomMeterNoteLevel = "over" | "warning" | "info";

export interface RoomMeterNote {
	level: RoomMeterNoteLevel;
	text: string;
}

/**
 * The single most important note for a meter, in priority order: over the total room, over
 * the annual limit, budget does not fit, annual room capped by the total room.
 */
export function getRoomMeterNote(
	meter: RoomMeterModel,
	plan: RegisteredPlan,
	year: number,
	formatCurrency: (amount: number) => string
): RoomMeterNote | null {
	const roomTerm = getRoomTerm(plan);
	// TFSA and RRSP room carries forward, and FHSA participation room includes carried-forward
	// room, so going past the yearly figure is fine while the total room still covers it.
	// RESP has no yearly limit.
	const carriesForward = plan === "tfsa" || plan === "rrsp" || plan === "fhsa";

	if (meter.totalLeft !== null && meter.totalLeft < 0) {
		const excess = Math.abs(meter.totalLeft);
		const monthlyTax = estimateMonthlyOverContributionTax(plan, excess);
		const tax = monthlyTax > 0 ? `, about ${formatCurrency(monthlyTax)} a month in CRA tax` : "";
		return { level: "over", text: `${formatCurrency(excess)} over your total ${roomTerm}${tax}` };
	}
	if (meter.overAnnual > 0) {
		return carriesForward
			? {
					level: "info",
					text: `${formatCurrency(meter.overAnnual)} above the ${year} limit, covered by room from earlier years`,
				}
			: {
					level: "over",
					text: `${formatCurrency(meter.overAnnual)} over the ${year} ${getContributionPlanLabel(plan)} limit`,
				};
	}
	if (meter.leftAfterBudget < 0) {
		return {
			level: "warning",
			text: `This month's budget is ${formatCurrency(Math.abs(meter.leftAfterBudget))} more than the room left`,
		};
	}
	if (meter.cappedByTotal) {
		return { level: "info", text: `Limited by your total ${roomTerm}` };
	}
	return null;
}

/** Share of this month's budget already contributed, 0–100. */
export function getBudgetProgressPercent(contributed: number, budget: number): number {
	if (budget > 0) return Math.min(100, Math.max(0, (contributed / budget) * 100));
	return contributed > 0 ? 100 : 0;
}

/** Share of the period's room already used, 0–100. */
export function getRoomUsedPercent(meter: Pick<RoomMeterModel, "used" | "total">): number {
	if (meter.total > 0) return Math.min(100, Math.max(0, (meter.used / meter.total) * 100));
	return meter.used > 0 ? 100 : 0;
}
