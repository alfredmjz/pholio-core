import { describe, expect, test } from "bun:test";
import {
	CONTRIBUTION_PLAN_OPTIONS,
	REGISTERED_PLANS,
	getContributionNotices,
	getContributionPlanLabel,
	isRegisteredPlan,
} from "@/lib/contribution-plans";
import { compareAlphabetically } from "@/lib/sort-utils";
import { fmt, makePool } from "../support/contribution-fixtures";

const levels = (notices: ReturnType<typeof getContributionNotices>) => notices.map((n) => n.level);

describe("plan helpers", () => {
	test("registered plans are the four CRA plans, in alphabetical order (ADR-003)", () => {
		expect(REGISTERED_PLANS).toEqual(["fhsa", "resp", "rrsp", "tfsa"]);
		const labels = REGISTERED_PLANS.map(getContributionPlanLabel);
		expect([...labels].sort(compareAlphabetically)).toEqual(labels);
	});

	test("isRegisteredPlan excludes other and empty values", () => {
		expect(isRegisteredPlan("tfsa")).toBe(true);
		expect(isRegisteredPlan("other")).toBe(false);
		expect(isRegisteredPlan(null)).toBe(false);
		expect(isRegisteredPlan("")).toBe(false);
	});

	test("Other is listed last in the account plan options", () => {
		expect(CONTRIBUTION_PLAN_OPTIONS.at(-1)?.value).toBe("other");
	});

	test("unknown plans fall back to a generic label", () => {
		expect(getContributionPlanLabel(null)).toBe("Investment");
	});
});

describe("getContributionNotices", () => {
	test("no notices for pools that do not track room", () => {
		expect(getContributionNotices(makePool({ tracks_room: false }), fmt, 99999)).toEqual([]);
		expect(getContributionNotices(null, fmt)).toEqual([]);
	});

	test("no notices when a deposit fits in both the annual and total room", () => {
		expect(getContributionNotices(makePool(), fmt, 1000)).toEqual([]);
	});

	test("warns when a deposit goes over the total room, with CRA's 1% tax", () => {
		const notices = getContributionNotices(makePool(), fmt, 21500);
		expect(notices).toHaveLength(1);
		expect(notices[0]).toEqual({
			level: "exceeded",
			message: "$1500.00 over your TFSA contribution room. CRA charges 1% per month on $1500.00 until it is withdrawn.",
		});
	});

	test("RRSP over-contributions within the $2,000 buffer are a softer warning", () => {
		const rrsp = makePool({ pool_key: "rrsp", contribution_plan: "rrsp", annual_limit: null, annual_remaining: null });
		expect(getContributionNotices(rrsp, fmt, 21500)[0].level).toBe("warning");
		expect(getContributionNotices(rrsp, fmt, 21500)[0].message).toContain("within CRA's $2,000 buffer");
	});

	test("RRSP over-contributions above the buffer are taxed only on the part over $2,000", () => {
		const rrsp = makePool({ pool_key: "rrsp", contribution_plan: "rrsp", annual_limit: null, annual_remaining: null });
		const [notice] = getContributionNotices(rrsp, fmt, 22500);
		expect(notice.level).toBe("exceeded");
		expect(notice.message).toContain("CRA charges 1% per month on $500.00");
	});

	test("warns when at least 90% of the total room would be used", () => {
		// $25,000 available, $5,000 used: a $17,500 deposit leaves $2,500 (90% used).
		const notices = getContributionNotices(makePool({ annual_remaining: 50000 }), fmt, 17500);
		expect(notices).toEqual([{ level: "warning", message: "Only $2500.00 of TFSA contribution room left." }]);
	});

	test("TFSA above the annual limit but within total room is information only", () => {
		const notices = getContributionNotices(makePool(), fmt, 3000);
		expect(levels(notices)).toEqual(["info"]);
		expect(notices[0].message).toContain("$1000.00 above this year's $7000.00 limit");
	});

	test("FHSA above the annual limit is a warning", () => {
		const fhsa = makePool({ pool_key: "fhsa", contribution_plan: "fhsa", annual_limit: 8000, annual_remaining: 1000 });
		const notices = getContributionNotices(fhsa, fmt, 1500);
		expect(notices).toEqual([{ level: "warning", message: "$500.00 above this year's FHSA limit of $8000.00." }]);
	});

	test("the annual notice is dropped when the total room is already exceeded", () => {
		expect(levels(getContributionNotices(makePool(), fmt, 30000))).toEqual(["exceeded"]);
	});

	test("asks for a fresh CRA figure when RRSP/FHSA room is from an earlier year", () => {
		const stale = makePool({ contribution_plan: "rrsp", room_needs_update: true, room_as_of: "2025-05-01" });
		const notices = getContributionNotices(stale, fmt);
		expect(notices).toEqual([
			{
				level: "info",
				message:
					"Your RRSP room was entered for 2025. Copy this year's figure from CRA My Account and update the account.",
			},
		]);
	});

	test("negative pending amounts are ignored", () => {
		expect(getContributionNotices(makePool(), fmt, -50000)).toEqual([]);
	});
});
