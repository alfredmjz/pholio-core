import { describe, expect, test } from "bun:test";
import { buildReminderEmail, findDueReminders, nextCardDueDate, type ReminderCard } from "@/lib/reminders";

const card = (overrides: Partial<ReminderCard> = {}): ReminderCard => ({
	id: "card-1",
	name: "Visa",
	balance: 450,
	dueDay: 27,
	...overrides,
});

describe("nextCardDueDate", () => {
	test("is this month when the due day is today or later", () => {
		expect(nextCardDueDate(27, "2026-10-24")).toBe("2026-10-27");
		expect(nextCardDueDate(24, "2026-10-24")).toBe("2026-10-24");
	});

	test("rolls to next month once the day has passed", () => {
		expect(nextCardDueDate(5, "2026-10-24")).toBe("2026-11-05");
		expect(nextCardDueDate(15, "2026-12-20")).toBe("2027-01-15");
	});

	test("clamps to the last day of a short month", () => {
		// Due on the 31st: February 2026 has 28 days, so it's due 28 February.
		expect(nextCardDueDate(31, "2026-02-10")).toBe("2026-02-28");
		// 2028 is a leap year.
		expect(nextCardDueDate(30, "2028-02-01")).toBe("2028-02-29");
		// 31 October has passed by 1 November; November has 30 days.
		expect(nextCardDueDate(31, "2026-11-01")).toBe("2026-11-30");
	});
});

describe("findDueReminders", () => {
	const today = "2026-10-24";

	test("includes items due from today up to the lead days, soonest first", () => {
		const reminders = findDueReminders({
			today,
			leadDays: 3,
			cards: [card({ dueDay: 27 })],
			recurring: [
				{ id: "r1", name: "Rent", amount: 1800, nextDueDate: "2026-10-24", category: "bill" },
				{ id: "r2", name: "Netflix", amount: 18.99, nextDueDate: "2026-10-26", category: "subscription" },
				{ id: "r3", name: "Gym", amount: 40, nextDueDate: "2026-10-28", category: "subscription" },
				{ id: "r4", name: "Phone", amount: 65, nextDueDate: "2026-10-20", category: "bill" },
			],
		});

		// Gym is 4 days out (past 3) and Phone is overdue, so neither is a reminder.
		expect(reminders.map((r) => [r.name, r.dueDate, r.daysUntil, r.detail])).toEqual([
			["Rent", "2026-10-24", 0, "Bill"],
			["Netflix", "2026-10-26", 2, "Subscription renewal"],
			["Visa", "2026-10-27", 3, "Credit card payment"],
		]);
		expect(reminders[2]).toMatchObject({ kind: "card_due", refId: "card-1", amount: 450 });
	});

	test("skips cards with nothing owed or an invalid due day", () => {
		const reminders = findDueReminders({
			today,
			leadDays: 14,
			cards: [card({ id: "paid", balance: 0 }), card({ id: "credit", balance: -20 }), card({ id: "bad", dueDay: 0 })],
			recurring: [],
		});
		expect(reminders).toEqual([]);
	});

	test("counts days across a month end", () => {
		const reminders = findDueReminders({
			today: "2026-10-30",
			leadDays: 3,
			cards: [card({ dueDay: 2 })],
			recurring: [],
		});
		expect(reminders.map((r) => [r.dueDate, r.daysUntil])).toEqual([["2026-11-02", 3]]);
	});
});

describe("buildReminderEmail", () => {
	const links = { app: "https://app.test/dashboard", settings: "https://app.test/settings#notifications" };
	const reminders = findDueReminders({
		today: "2026-10-24",
		leadDays: 7,
		cards: [card({ dueDay: 25, name: "TD - Visa <Gold>" })],
		recurring: [{ id: "r1", name: "Hydro", amount: 82.4, nextDueDate: "2026-10-29", category: "bill" }],
	});

	test("lists each item with its amount and when it's due", () => {
		const email = buildReminderEmail(reminders, { locale: "en-CA", currency: "CAD" }, links);
		expect(email.subject).toBe("2 payments coming up in Pholio");
		expect(email.text).toContain("- TD - Visa <Gold>: $450.00, due tomorrow (Credit card payment)");
		expect(email.text).toContain("- Hydro: $82.40, due Thu, Oct 29 (Bill)");
		expect(email.text).toContain("Change or turn off reminders: https://app.test/settings#notifications");
	});

	test("escapes names in the HTML", () => {
		const email = buildReminderEmail(reminders, { locale: "en-CA", currency: "CAD" }, links);
		expect(email.html).toContain("TD - Visa &lt;Gold&gt;");
		expect(email.html).not.toContain("<Gold>");
	});

	test("names a single item in the subject", () => {
		const email = buildReminderEmail(reminders.slice(1), { locale: "en-GB", currency: "GBP" }, links);
		expect(email.subject).toBe("Hydro is due Thu, 29 Oct");
		expect(email.text).toContain("£82.40");
	});

	test("every amount is written in the user's currency, with no conversion", () => {
		const email = buildReminderEmail(reminders, { locale: "en-GB", currency: "EUR" }, links);
		expect(email.text).toContain("TD - Visa <Gold>: €450.00");
		expect(email.text).toContain("Hydro: €82.40");
	});
});
