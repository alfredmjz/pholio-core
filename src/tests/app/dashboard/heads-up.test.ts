import { describe, expect, test } from "bun:test";
import { buildHeadsUp, selectUpcomingBills, type BillInput, type HeadsUpPromotion } from "@/app/dashboard/heads-up";

const today = "2026-10-20";

const bills: BillInput[] = [
	{ id: "rent", name: "Rent", amount: 1800, dueDate: "2026-11-01", status: "upcoming" },
	{ id: "net", name: "Internet", amount: 80, dueDate: "2026-10-15T04:00:00.000Z", status: "overdue" },
	{ id: "gym", name: "Gym", amount: 45, dueDate: "2026-10-20", status: "due_today" },
	{ id: "paid", name: "Phone", amount: 60, dueDate: "2026-10-22", status: "paid" },
	{ id: "off", name: "Old app", amount: 5, dueDate: "2026-10-23", status: "upcoming", isActive: false },
	{ id: "far", name: "Insurance", amount: 900, dueDate: "2026-11-30", status: "upcoming" },
];

const promotion = (overrides: Partial<HeadsUpPromotion>): HeadsUpPromotion => ({
	id: "p1",
	accountId: "acc-4",
	accountName: "Sapphire",
	type: "spend_threshold",
	target: 4000,
	current: 2850,
	reward: "60,000 points",
	endDate: "2026-11-12",
	isCompleted: false,
	...overrides,
});

describe("selectUpcomingBills", () => {
	test("keeps unpaid, active bills due through the next 14 days, soonest first", () => {
		const upcoming = selectUpcomingBills(bills, today);
		expect(upcoming.map((b) => [b.id, b.daysUntil])).toEqual([
			["net", -5],
			["gym", 0],
			["rent", 12],
		]);
		expect(upcoming[0].dueDate).toBe("2026-10-15");
	});
});

describe("buildHeadsUp", () => {
	test("orders overdue bills, then over-budget categories, then promotions", () => {
		const items = buildHeadsUp({
			today,
			bills,
			categories: [
				{ id: "dining", name: "Dining", budget: 200, spent: 242 },
				{ id: "fun", name: "Fun", budget: 100, spent: 300 },
				{ id: "food", name: "Groceries", budget: 600, spent: 400 },
			],
			promotions: [promotion({})],
			limit: 10,
		});

		expect(items.map((i) => i.id)).toEqual(["bill-net", "category-fun", "category-dining", "promotion-p1"]);
		expect(items[0]).toMatchObject({
			title: "Internet is overdue",
			detail: "$80.00 was due Oct 15",
			href: "/recurring",
		});
		expect(items[2].detail).toBe("$42 over its $200 budget");
		expect(items[3]).toMatchObject({
			title: "Spend $1,150 more on Sapphire",
			detail: "by Nov 12, 23 days left, for 60,000 points",
			href: "/accounts/acc-4",
		});
	});

	test("several overdue bills become one item", () => {
		const [item, ...rest] = buildHeadsUp({
			today,
			bills: [...bills, { id: "gas", name: "Gas", amount: 60.5, dueDate: "2026-10-12", status: "overdue" }],
			categories: [],
			promotions: [],
		});
		expect(rest).toEqual([]);
		// 60.50 + 80.00, oldest Oct 12
		expect(item).toMatchObject({
			id: "bills-overdue",
			title: "2 bills are overdue",
			detail: "$140.50 in total, oldest due Oct 12",
		});
	});

	test("caps the list at three by default", () => {
		const categories = ["a", "b", "c", "d"].map((id) => ({ id, name: id, budget: 10, spent: 20 }));
		expect(buildHeadsUp({ today, bills: [], categories, promotions: [] })).toHaveLength(3);
	});

	test("skips promotions that are met, finished, ended or far off", () => {
		const items = buildHeadsUp({
			today,
			bills: [],
			categories: [],
			promotions: [
				promotion({ id: "met", current: 4000 }),
				promotion({ id: "done", isCompleted: true }),
				promotion({ id: "ended", endDate: "2026-10-19" }),
				promotion({ id: "far", endDate: "2026-12-31" }),
			],
		});
		expect(items).toEqual([]);
	});

	test("a short maintaining-balance promotion asks for a top-up", () => {
		const [item] = buildHeadsUp({
			today,
			bills: [],
			categories: [],
			promotions: [
				promotion({ type: "maintaining_balance", target: 5000, current: 4200, endDate: "2026-10-20", reward: "$300" }),
			],
		});
		expect(item.title).toBe("Add $800 to Sapphire");
		expect(item.detail).toBe("to hold $5,000 by Oct 20, ends today, for $300");
	});
});
