import { describe, expect, test } from "bun:test";
import {
	CONTRIBUTION_PLAN_OPTIONS,
	REGISTERED_PLANS,
	capitalizeRoomTerm,
	getRoomTerm,
	getRoomTitle,
	estimateMonthlyOverContributionTax,
	formatContributionAmount,
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

	test("warns when a deposit goes over the total room, with CRA's monthly tax", () => {
		const notices = getContributionNotices(makePool(), fmt, 21500);
		expect(notices).toEqual([
			{
				level: "exceeded",
				message:
					"$1500.00 over your TFSA contribution room. CRA charges 1% a month, about $15.00 a month until it is withdrawn.",
			},
		]);
	});

	test("an existing excess shows the tax estimated so far this year", () => {
		const over = makePool({
			room_remaining: -500,
			excess_amount: 500,
			tax_this_month: 5,
			tax_this_year: 40,
			tax_total: 40,
		});
		expect(getContributionNotices(over, fmt)[0].message).toBe(
			"$500.00 over your TFSA contribution room. CRA charges 1% a month, about $5.00 a month until it is withdrawn. Estimated tax so far this year: $40.00."
		);
	});

	test("adding to an excess previews the new monthly tax", () => {
		const over = makePool({ room_remaining: -500, excess_amount: 500, tax_this_year: 40 });
		// The preview is for the deposit; the tax so far is shown on the card, not in the dialog.
		expect(getContributionNotices(over, fmt, 300)[0].message).toBe(
			"$800.00 over your TFSA contribution room. CRA charges 1% a month, about $8.00 a month until it is withdrawn."
		);
	});

	test("each plan's warning uses CRA's own term for its room", () => {
		const fhsa = makePool({ pool_key: "fhsa", contribution_plan: "fhsa", annual_limit: 8000, annual_remaining: 8000 });
		// A fresh pool: $1,000 participation room, nothing used yet.
		const fresh = { ...fhsa, room_entered: 1000, room_used: 0, room_remaining: 1000, year_contributions: 0 };
		expect(getContributionNotices(fresh, fmt, 1500)[0].message).toBe(
			"$500.00 over your FHSA participation room. CRA charges 1% a month, about $5.00 a month until it is withdrawn."
		);
		const resp = {
			...fresh,
			pool_key: "resp",
			contribution_plan: "resp" as const,
			annual_limit: null,
			annual_remaining: null,
		};
		expect(getContributionNotices(resp, fmt, 1500)[0].message).toContain("over your RESP contribution room.");
	});

	test("Other accounts can go over their room but have no CRA tax", () => {
		const other = makePool({
			contribution_plan: "other",
			pool_key: "acc-9",
			annual_limit: null,
			annual_remaining: null,
		});
		expect(getContributionNotices(other, fmt, 21000)).toEqual([
			{ level: "exceeded", message: "$1000.00 over the contribution room you set for this account." },
		]);
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
		expect(notice.message).toBe(
			"$2500.00 over your RRSP deduction limit. CRA charges 1% a month on the $500.00 above the $2,000 buffer, about $5.00 a month until it is withdrawn."
		);
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

	test("FHSA above the yearly figure is information only, since carried-forward room can cover it", () => {
		const fhsa = makePool({ pool_key: "fhsa", contribution_plan: "fhsa", annual_limit: 8000, annual_remaining: 1000 });
		const notices = getContributionNotices(fhsa, fmt, 1500);
		expect(notices).toEqual([
			{
				level: "info",
				message:
					"$500.00 above this year's $8000.00 limit. Unused room from earlier years can cover this, so check your remaining room.",
			},
		]);
	});

	test("RESP has no annual limit, so only the lifetime room matters", () => {
		const resp = makePool({ pool_key: "resp", contribution_plan: "resp", annual_limit: null, annual_remaining: null });
		expect(getContributionNotices(resp, fmt, 1000)).toEqual([]);
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
					"Your RRSP deduction limit was entered for 2025. Copy this year's figure from CRA My Account and update the account.",
			},
		]);
	});

	test("negative pending amounts are ignored", () => {
		expect(getContributionNotices(makePool(), fmt, -50000)).toEqual([]);
	});
});

describe("estimateMonthlyOverContributionTax", () => {
	test("is 1% of the excess for TFSA, FHSA and RESP", () => {
		expect(estimateMonthlyOverContributionTax("tfsa", 500)).toBe(5);
		expect(estimateMonthlyOverContributionTax("fhsa", 1234.56)).toBe(12.35);
		expect(estimateMonthlyOverContributionTax("resp", 333.33)).toBe(3.33);
	});

	test("RRSP is taxed only above the $2,000 buffer", () => {
		expect(estimateMonthlyOverContributionTax("rrsp", 2000)).toBe(0);
		expect(estimateMonthlyOverContributionTax("rrsp", 2500)).toBe(5);
	});

	test("nothing for no excess or for Other accounts", () => {
		expect(estimateMonthlyOverContributionTax("tfsa", 0)).toBe(0);
		expect(estimateMonthlyOverContributionTax("tfsa", -50)).toBe(0);
		expect(estimateMonthlyOverContributionTax("other", 500)).toBe(0);
		expect(estimateMonthlyOverContributionTax(null, 500)).toBe(0);
	});
});

describe("formatContributionAmount", () => {
	test("shows cents, as CRA does", () => {
		expect(formatContributionAmount(1000)).toBe("$1,000.00");
		expect(formatContributionAmount(1234.56)).toBe("$1,234.56");
		expect(formatContributionAmount(-500.4)).toBe("-$500.40");
		expect(formatContributionAmount(0)).toBe("$0.00");
	});
});

describe("getRoomTerm", () => {
	test("uses CRA's name for each plan's figure", () => {
		expect(getRoomTerm("tfsa")).toBe("TFSA contribution room");
		expect(getRoomTerm("rrsp")).toBe("RRSP deduction limit");
		expect(getRoomTerm("fhsa")).toBe("FHSA participation room");
		expect(getRoomTerm("resp")).toBe("RESP contribution room");
		expect(getRoomTerm("other")).toBe("contribution room");
	});

	test("titles and sentence starts are derived from the same term", () => {
		expect(getRoomTitle("rrsp")).toBe("RRSP Deduction Limit");
		expect(getRoomTitle("fhsa")).toBe("FHSA Participation Room");
		expect(getRoomTitle(null)).toBe("Contribution Room");
		expect(capitalizeRoomTerm("tfsa")).toBe("TFSA contribution room");
		expect(capitalizeRoomTerm("other")).toBe("Contribution room");
	});
});
