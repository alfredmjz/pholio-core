import { describe, expect, test } from "bun:test";
import {
	cardStatement,
	isCardInterestWaived,
	lastEndedCycle,
	latestClosedCycle,
	monthlyDayOnOrBefore,
	statementCloseDate,
	type StatementLedgerRow,
} from "@/lib/credit-card-statement";

const row = (transaction_date: string, amount: number): StatementLedgerRow => ({ transaction_date, amount });

describe("monthlyDayOnOrBefore", () => {
	test("is this month once the day has come, otherwise last month", () => {
		expect(monthlyDayOnOrBefore(21, "2026-10-21")).toBe("2026-10-21");
		expect(monthlyDayOnOrBefore(21, "2026-10-31")).toBe("2026-10-21");
		expect(monthlyDayOnOrBefore(21, "2026-10-20")).toBe("2026-09-21");
		expect(monthlyDayOnOrBefore(15, "2026-01-10")).toBe("2025-12-15");
	});

	test("clamps to the last day of a short month", () => {
		expect(monthlyDayOnOrBefore(31, "2026-03-15")).toBe("2026-02-28");
		expect(monthlyDayOnOrBefore(30, "2028-03-01")).toBe("2028-02-29");
	});
});

describe("statementCloseDate", () => {
	test("is 21 days before the due date when the card has no statement day", () => {
		// 21 October less 21 days is 30 September.
		expect(statementCloseDate("2026-10-21")).toBe("2026-09-30");
		expect(statementCloseDate("2026-03-05", null)).toBe("2026-02-12");
	});

	test("is the last statement day before the due date", () => {
		expect(statementCloseDate("2026-11-20", 25)).toBe("2026-10-25");
		expect(statementCloseDate("2026-10-28", 5)).toBe("2026-10-05");
		// The same day as the due date belongs to the month before.
		expect(statementCloseDate("2026-10-15", 15)).toBe("2026-09-15");
		// Closing on the 31st in February clamps to the 28th.
		expect(statementCloseDate("2026-03-25", 31)).toBe("2026-02-28");
	});
});

describe("latestClosedCycle", () => {
	test("is the statement closed on or before today", () => {
		// Due the 21st, closes 21 days before. The 21 November statement closes 31 October.
		expect(latestClosedCycle({ dueDay: 21 }, "2026-10-31")).toEqual({ closeDate: "2026-10-31", dueDate: "2026-11-21" });
		// On 30 October that statement hasn't closed, so the one due 21 October is still the latest.
		expect(latestClosedCycle({ dueDay: 21 }, "2026-10-30")).toEqual({ closeDate: "2026-09-30", dueDate: "2026-10-21" });
	});

	test("uses the statement day when the card has one", () => {
		expect(latestClosedCycle({ dueDay: 20, statementDay: 25 }, "2026-10-31")).toEqual({
			closeDate: "2026-10-25",
			dueDate: "2026-11-20",
		});
		expect(latestClosedCycle({ dueDay: 20, statementDay: 25 }, "2026-10-24")).toEqual({
			closeDate: "2026-09-25",
			dueDate: "2026-10-20",
		});
	});

	test("has no statement without a due day", () => {
		expect(latestClosedCycle({ dueDay: null }, "2026-10-31")).toBeNull();
		expect(latestClosedCycle({ dueDay: 0 }, "2026-10-31")).toBeNull();
	});
});

describe("lastEndedCycle", () => {
	test("is the statement whose due date fell before the date", () => {
		expect(lastEndedCycle({ dueDay: 21 }, "2026-11-01")).toEqual({ closeDate: "2026-09-30", dueDate: "2026-10-21" });
		// A payment due today can still be made today, so today's due date hasn't ended.
		expect(lastEndedCycle({ dueDay: 1 }, "2026-11-01")).toEqual({ closeDate: "2026-09-10", dueDate: "2026-10-01" });
	});
});

describe("cardStatement", () => {
	const cycle = { closeDate: "2026-09-30", dueDate: "2026-10-21" };

	test("works the statement balance back from today's balance", () => {
		// Owing 800 today. After the close: +120.50, -500, +679.50 = +300, so 500 was owed at the close.
		const statement = cardStatement(
			800,
			[row("2026-09-12", 75), row("2026-10-05", 120.5), row("2026-10-15", -500), row("2026-10-25", 679.5)],
			cycle
		);
		expect(statement).toEqual({
			...cycle,
			statementBalance: 500,
			paidSinceClose: 500,
			remainingDue: 0,
			paidInFull: true,
		});
	});

	test("counts a charge on the closing day in that statement", () => {
		// 200 today, 60 charged on the close day, nothing after: the statement is 200.
		expect(cardStatement(200, [row("2026-09-30", 60)], cycle).statementBalance).toBe(200);
	});

	test("leaves what a partial payment didn't cover", () => {
		// Owing 1000. After the close: +120.50, -300, +679.50 = +500, so the statement is 500; 300 paid leaves 200.
		const statement = cardStatement(
			1000,
			[row("2026-10-05", 120.5), row("2026-10-15", -300), row("2026-10-25", 679.5)],
			cycle
		);
		expect(statement).toMatchObject({
			statementBalance: 500,
			paidSinceClose: 300,
			remainingDue: 200,
			paidInFull: false,
		});
	});

	test("doesn't count a payment made after the due date", () => {
		// Owing 300 today; 500 paid on 22 October, a day late. The statement was 800 and none of it was paid on time.
		const statement = cardStatement(300, [row("2026-10-22", -500)], cycle);
		expect(statement).toMatchObject({ statementBalance: 800, paidSinceClose: 0, remainingDue: 800, paidInFull: false });
	});

	test("treats a credit at the close as nothing due", () => {
		// 40 owing today after 90 of charges, so the card was 50 in credit at the close.
		const statement = cardStatement(40, [row("2026-10-03", 90)], cycle);
		expect(statement).toMatchObject({ statementBalance: -50, remainingDue: 0, paidInFull: true });
	});

	test("adds cents without float drift", () => {
		// 0.30 owing; 0.10 + 0.20 charged after the close, so the statement was exactly 0.
		const statement = cardStatement(0.3, [row("2026-10-01", 0.1), row("2026-10-02", 0.2)], cycle);
		expect(statement.statementBalance).toBe(0);
		expect(statement.paidInFull).toBe(true);
	});
});

describe("isCardInterestWaived", () => {
	// The 1 November run checks the statement closed 30 September and due 21 October.
	const runDate = "2026-11-01";

	test("waives interest when the statement was paid in full by the due date", () => {
		const rows = [row("2026-10-05", 120.5), row("2026-10-15", -500), row("2026-10-25", 679.5)];
		expect(isCardInterestWaived({ dueDay: 21 }, 800, rows, runDate)).toBe(true);
	});

	test("charges interest when part of the statement is still owed", () => {
		const rows = [row("2026-10-05", 120.5), row("2026-10-15", -300), row("2026-10-25", 679.5)];
		expect(isCardInterestWaived({ dueDay: 21 }, 1000, rows, runDate)).toBe(false);
	});

	test("charges interest when the payment came after the due date", () => {
		expect(isCardInterestWaived({ dueDay: 21 }, 300, [row("2026-10-22", -500)], runDate)).toBe(false);
	});

	test("charges interest as before when the card has no due day, so no statement", () => {
		expect(isCardInterestWaived({ dueDay: null }, 800, [], runDate)).toBe(false);
	});

	test("waives interest when nothing was owed at the close", () => {
		// New purchases since the close don't earn interest while the last statement was clear.
		expect(isCardInterestWaived({ dueDay: 21 }, 450, [row("2026-10-10", 450)], runDate)).toBe(true);
	});

	test("uses the statement day when the card has one", () => {
		// Due the 20th, closes the 25th: the run checks the statement closed 25 September and due 20 October.
		// Owing 600 today. After the close: +350, -350, +250 = +250, so 350 was owed and 350 paid on the due date.
		const rows = [row("2026-09-26", 350), row("2026-10-20", -350), row("2026-10-28", 250)];
		expect(isCardInterestWaived({ dueDay: 20, statementDay: 25 }, 600, rows, runDate)).toBe(true);
		// The same payment a day late leaves the statement unpaid.
		const late = [row("2026-09-26", 350), row("2026-10-21", -350), row("2026-10-28", 250)];
		expect(isCardInterestWaived({ dueDay: 20, statementDay: 25 }, 600, late, runDate)).toBe(false);
	});
});
