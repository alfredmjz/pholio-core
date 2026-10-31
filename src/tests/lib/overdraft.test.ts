import { describe, expect, test } from "bun:test";
import {
	feeForBalance,
	feeWarningUntil,
	hasFeeTerms,
	overdraftInterest,
	projectAccountFees,
	projectedFeesByRecurring,
	projectedFeeText,
	scheduledPayments,
	type FeeTerms,
} from "@/lib/overdraft";

const chequing = (balance: number, terms: Partial<FeeTerms> = {}): FeeTerms => ({
	current_balance: balance,
	credit_limit: null,
	account_type: { class: "asset" },
	...terms,
});
const card = (balance: number, limit: number | null, overLimitFee: number | null): FeeTerms => ({
	current_balance: balance,
	credit_limit: limit,
	over_limit_fee: overLimitFee,
	account_type: { class: "liability" },
});
const protectedChequing = (balance: number) =>
	chequing(balance, { overdraft_protection: true, overdraft_limit: 200, overdraft_fee: 5, nsf_fee: 48 });

describe("feeForBalance", () => {
	test("no protection: any balance below zero is an NSF fee", () => {
		expect(feeForBalance(chequing(0, { nsf_fee: 45 }), -0.01)).toEqual({ kind: "nsf", amount: 45 });
		expect(feeForBalance(chequing(0, { nsf_fee: 45 }), 0)).toBeNull();
	});

	test("protection: overdraft fee down to the limit, NSF past it", () => {
		const account = protectedChequing(0);
		expect(feeForBalance(account, -50)).toEqual({ kind: "overdraft", amount: 5 });
		expect(feeForBalance(account, -200)).toEqual({ kind: "overdraft", amount: 5 });
		expect(feeForBalance(account, -200.01)).toEqual({ kind: "nsf", amount: 48 });
	});

	test("protection with no overdraft fee charges nothing within the limit", () => {
		expect(
			feeForBalance(chequing(0, { overdraft_protection: true, overdraft_limit: 100, nsf_fee: 48 }), -40)
		).toBeNull();
	});

	test("a card past its limit pays the over-limit fee; at the limit it does not", () => {
		expect(feeForBalance(card(0, 1000, 29), 1010)).toEqual({ kind: "over_limit", amount: 29 });
		expect(feeForBalance(card(0, 1000, 29), 1000)).toBeNull();
		expect(feeForBalance(card(0, null, 29), 5000)).toBeNull();
	});

	test("no fee set, no fee", () => {
		expect(feeForBalance(chequing(0), -100)).toBeNull();
		expect(feeForBalance(card(0, 1000, null), 1200)).toBeNull();
	});
});

describe("hasFeeTerms", () => {
	test("true only when some fee is above zero", () => {
		expect(hasFeeTerms(chequing(0))).toBe(false);
		expect(hasFeeTerms(chequing(0, { nsf_fee: 0 }))).toBe(false);
		expect(hasFeeTerms(chequing(0, { nsf_fee: 45 }))).toBe(true);
		expect(hasFeeTerms(card(0, 1000, 29))).toBe(true);
	});
});

describe("projectAccountFees", () => {
	const pay = (name: string, date: string, amount: number) => ({ recurringId: name, name, date, amount });

	test("$20 chequing, $60 phone bill, no protection: one $45 NSF fee", () => {
		expect(projectAccountFees(chequing(20, { nsf_fee: 45 }), [pay("Phone", "2026-11-05", 60)])).toEqual([
			{ kind: "nsf", amount: 45, recurringId: "Phone", paymentName: "Phone", date: "2026-11-05" },
		]);
	});

	test("payments post in date order and each fee lowers the balance for the next one", () => {
		// 100 - 80 = 20; - 90 = -70 (overdraft, 5) -> -75; - 130 = -205 past -200 (NSF, 48) -> -253; - 10 = -263 (NSF)
		const fees = projectAccountFees(protectedChequing(100), [
			pay("Gym", "2026-11-20", 130),
			pay("Rent", "2026-11-01", 80),
			pay("Phone", "2026-11-05", 90),
			pay("Music", "2026-11-25", 10),
		]);
		expect(fees.map((fee) => [fee.paymentName, fee.kind, fee.amount])).toEqual([
			["Phone", "overdraft", 5],
			["Gym", "nsf", 48],
			["Music", "nsf", 48],
		]);
	});

	test("a fee can tip the next payment past the limit", () => {
		// 0 - 196 = -196 (overdraft, 5) -> -201; the next 1 lands at -202, past -200 (NSF)
		const fees = projectAccountFees(protectedChequing(0), [pay("A", "2026-11-01", 196), pay("B", "2026-11-02", 1)]);
		expect(fees.map((fee) => fee.kind)).toEqual(["overdraft", "nsf"]);
	});

	test("a card: 950 owed, limit 1000, a 60 charge goes over", () => {
		expect(projectAccountFees(card(950, 1000, 29), [pay("Streaming", "2026-11-03", 60)])).toEqual([
			{ kind: "over_limit", amount: 29, recurringId: "Streaming", paymentName: "Streaming", date: "2026-11-03" },
		]);
	});

	test("enough money, no fees", () => {
		expect(projectAccountFees(chequing(500, { nsf_fee: 45 }), [pay("Phone", "2026-11-05", 60)])).toEqual([]);
	});

	test("cents add up exactly", () => {
		// 0.30 - 0.10 - 0.20 = 0.00 exactly, not -0.0000000001
		expect(
			projectAccountFees(chequing(0.3, { nsf_fee: 45 }), [pay("A", "2026-11-01", 0.1), pay("B", "2026-11-02", 0.2)])
		).toEqual([]);
	});
});

describe("scheduledPayments", () => {
	test("repeats each item up to the window end, including overdue dates", () => {
		const payments = scheduledPayments(
			[
				{ id: "phone", name: "Phone", amount: 60, next_due_date: "2026-10-25", billing_period: "1:months" },
				{ id: "gym", name: "Gym", amount: 20, next_due_date: "2026-11-01", billing_period: "1:weeks" },
				{ id: "car", name: "Insurance", amount: 900, next_due_date: "2027-01-01", billing_period: "1:years" },
			],
			"2026-11-28"
		);
		expect(payments.map((p) => `${p.recurringId} ${p.date}`)).toEqual([
			"phone 2026-10-25",
			"phone 2026-11-25",
			"gym 2026-11-01",
			"gym 2026-11-08",
			"gym 2026-11-15",
			"gym 2026-11-22",
		]);
	});
});

describe("feeWarningUntil", () => {
	test("30 days after today", () => {
		expect(feeWarningUntil("2026-10-29")).toBe("2026-11-28");
		expect(feeWarningUntil("2026-10-29", 3)).toBe("2026-11-01");
	});
});

describe("overdraftInterest", () => {
	test("-1000 at 21% a year is 17.50 for a month", () => {
		expect(overdraftInterest(-1000, 0.21)).toBe(-17.5);
	});

	test("rounds to cents: -333.33 at 19.99% is 5.55", () => {
		// 333.33 * 0.1999 / 12 = 5.5528...
		expect(overdraftInterest(-333.33, 0.1999)).toBe(-5.55);
	});

	test("nothing on a balance at or above zero, or with no rate", () => {
		expect(overdraftInterest(0, 0.21)).toBe(0);
		expect(overdraftInterest(50, 0.21)).toBe(0);
		expect(overdraftInterest(-100, null)).toBe(0);
	});
});

describe("projectedFeesByRecurring", () => {
	const item = (id: string, amount: number, next: string, accountId: string | null, isActive = true) => ({
		id,
		name: id,
		amount,
		next_due_date: next,
		billing_period: "1:months",
		account_id: accountId,
		is_active: isActive,
	});

	test("the first fee per item, across the account's items in date order", () => {
		const fees = projectedFeesByRecurring(
			[
				item("rent", 80, "2026-11-01", "chq"),
				item("phone", 60, "2026-11-05", "chq"),
				item("gym", 40, "2026-11-10", null),
				item("paused", 500, "2026-11-02", "chq", false),
			],
			[{ id: "chq", ...chequing(100, { nsf_fee: 45 }) }],
			"2026-11-28"
		);
		// 100 - 80 = 20; - 60 = -40: the phone bill is the one that overdraws
		expect(Array.from(fees.keys())).toEqual(["phone"]);
		expect(fees.get("phone")).toMatchObject({ kind: "nsf", amount: 45, date: "2026-11-05" });
	});

	test("accounts with no fee terms are skipped", () => {
		const fees = projectedFeesByRecurring(
			[item("phone", 60, "2026-11-05", "chq")],
			[{ id: "chq", ...chequing(0) }],
			"2026-11-28"
		);
		expect(fees.size).toBe(0);
	});
});

describe("projectedFeeText", () => {
	const format = { money: (amount: number) => `$${amount}`, date: (date: string) => date.slice(5) };

	test("an asset is overdrawn", () => {
		expect(
			projectedFeeText(
				{ kind: "nsf", amount: 45, recurringId: "p", paymentName: "Phone", date: "2026-11-05" },
				{ account: "Chequing", ...format }
			)
		).toBe("Phone on 11-05 will overdraw Chequing ($45 NSF fee)");
	});

	test("a card goes past its limit, with a different subject", () => {
		expect(
			projectedFeeText(
				{ kind: "over_limit", amount: 29, recurringId: "s", paymentName: "Streaming", date: "2026-11-03" },
				{ account: "Visa", subject: "The payment", ...format }
			)
		).toBe("The payment on 11-03 will put Visa past its limit ($29 over-limit fee)");
	});
});
