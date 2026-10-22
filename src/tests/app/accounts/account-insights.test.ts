import { describe, expect, test } from "bun:test";
import {
	accountProgress,
	buildAccountAlerts,
	creditUtilization,
	nextDueDate,
	sparklinePoints,
} from "@/app/accounts/account-insights";
import type { AccountWithType } from "@/app/accounts/types";

function account(overrides: Partial<AccountWithType> & { cls?: "asset" | "liability" }): AccountWithType {
	const { cls = "asset", ...rest } = overrides;
	return {
		id: "a",
		name: "Account",
		current_balance: 0,
		credit_limit: null,
		original_amount: null,
		payment_due_date: null,
		target_balance: null,
		account_type: { class: cls, code: cls === "asset" ? "savings" : "credit_card" },
		...rest,
	} as unknown as AccountWithType;
}

describe("creditUtilization", () => {
	test("adds balances and limits across liabilities that have a limit", () => {
		const result = creditUtilization([
			account({ id: "c1", cls: "liability", current_balance: 2450, credit_limit: 15000 }),
			account({ id: "c2", cls: "liability", current_balance: 550, credit_limit: 5000 }),
			// A loan has no limit and doesn't count
			account({ id: "l", cls: "liability", current_balance: 18500, original_amount: 25000 }),
			account({ id: "s", current_balance: 8500 }),
		]);
		// (2450 + 550) / (15000 + 5000) = 3000 / 20000 = 15%
		expect(result).toEqual({ used: 3000, limit: 20000, percent: 15 });
	});

	test("no limits means no utilization", () => {
		expect(creditUtilization([account({ current_balance: 10 })]).percent).toBeNull();
	});
});

describe("accountProgress", () => {
	test("savings toward a goal", () => {
		expect(accountProgress(account({ current_balance: 8500, target_balance: 10000 }))).toEqual({
			label: "85% of goal",
			percent: 85,
			tone: "positive",
		});
	});

	test("a card past 30% of its limit is flagged", () => {
		expect(accountProgress(account({ cls: "liability", current_balance: 4500, credit_limit: 10000 }))).toEqual({
			label: "45% of limit used",
			percent: 45,
			tone: "caution",
		});
	});

	test("a loan shows how much is paid off", () => {
		// (25000 - 18500) / 25000 = 26%
		expect(accountProgress(account({ cls: "liability", current_balance: 18500, original_amount: 25000 }))?.label).toBe(
			"26% paid off"
		);
	});

	test("nothing to measure against", () => {
		expect(accountProgress(account({ current_balance: 100 }))).toBeNull();
	});
});

describe("nextDueDate", () => {
	test("later this month, or next month once the day has passed", () => {
		expect(nextDueDate(25, "2026-10-22")).toBe("2026-10-25");
		expect(nextDueDate(22, "2026-10-22")).toBe("2026-10-22");
		expect(nextDueDate(5, "2026-10-22")).toBe("2026-11-05");
		expect(nextDueDate(5, "2026-12-22")).toBe("2027-01-05");
	});

	test("a day past the month's end falls on its last day", () => {
		expect(nextDueDate(31, "2026-11-10")).toBe("2026-11-30");
		expect(nextDueDate(30, "2027-02-01")).toBe("2027-02-28");
	});
});

describe("buildAccountAlerts", () => {
	const today = "2026-10-22";

	test("orders payments due, high utilization, then goals reached", () => {
		const alerts = buildAccountAlerts({
			today,
			accounts: [
				account({ id: "goal", name: "Emergency Fund", current_balance: 10500, target_balance: 10000 }),
				account({ id: "hot", name: "Visa", cls: "liability", current_balance: 4500, credit_limit: 10000 }),
				account({ id: "due", name: "Amex", cls: "liability", current_balance: 300, payment_due_date: 25 }),
				account({ id: "far", name: "Loan", cls: "liability", current_balance: 900, payment_due_date: 15 }),
			],
		});
		expect(alerts.map((a) => a.id)).toEqual(["due-due", "utilization-hot", "goal-goal"]);
		expect(alerts[0]).toMatchObject({
			title: "Amex payment due in 3 days",
			detail: "Oct 25, $300.00 owing",
			href: "/accounts/due",
		});
		expect(alerts[1].title).toBe("Visa is at 45% of its limit");
		expect(alerts[2].detail).toBe("$10,500 saved toward $10,000");
	});

	test("paid-off cards and cards under 30% stay quiet", () => {
		expect(
			buildAccountAlerts({
				today,
				accounts: [
					account({ cls: "liability", current_balance: 0, payment_due_date: 23, credit_limit: 1000 }),
					account({ id: "b", cls: "liability", current_balance: 200, credit_limit: 1000 }),
				],
			})
		).toEqual([]);
	});

	test("includes promotions ending soon", () => {
		const [alert] = buildAccountAlerts({
			today,
			accounts: [],
			promotions: [
				{
					id: "p",
					accountId: "card",
					accountName: "Sapphire",
					type: "spend_threshold",
					target: 4000,
					current: 2850,
					reward: "60,000 points",
					endDate: "2026-11-14",
					isCompleted: false,
				},
			],
		});
		expect(alert).toMatchObject({ kind: "promotion", title: "Spend $1,150 more on Sapphire", href: "/accounts/card" });
	});
});

describe("sparklinePoints", () => {
	test("sorted history ending on today's balance", () => {
		expect(
			sparklinePoints(
				[
					{ date: "2026-10-20", balance: 90 },
					{ date: "2026-10-01", balance: 70 },
					{ date: "2026-10-22", balance: 1 },
				],
				100,
				"2026-10-22"
			)
		).toEqual([
			{ date: "2026-10-01", balance: 70 },
			{ date: "2026-10-20", balance: 90 },
			{ date: "2026-10-22", balance: 100 },
		]);
	});
});
