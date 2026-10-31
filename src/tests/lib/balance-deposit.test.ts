import { describe, expect, test } from "bun:test";
import { balanceIncreaseDeposit } from "@/lib/balance-deposit";

const tracked = (balance: number) => ({ tracksRoom: true, balance });
const untracked = (balance: number) => ({ tracksRoom: false, balance });

describe("balanceIncreaseDeposit", () => {
	test("an opening balance on a tracked account is a deposit of the whole balance", () => {
		expect(balanceIncreaseDeposit(untracked(0), tracked(699.95))).toBe(699.95);
	});

	test("raising the balance deposits only the difference", () => {
		expect(balanceIncreaseDeposit(tracked(699.95), tracked(1000))).toBe(300.05);
	});

	test("avoids float noise", () => {
		expect(balanceIncreaseDeposit(tracked(0.1), tracked(0.3))).toBe(0.2);
	});

	test("lowering or keeping the balance records nothing", () => {
		expect(balanceIncreaseDeposit(tracked(500), tracked(400))).toBeNull();
		expect(balanceIncreaseDeposit(tracked(500), tracked(500))).toBeNull();
	});

	test("an untracked account records nothing", () => {
		expect(balanceIncreaseDeposit(untracked(0), untracked(699.95))).toBeNull();
	});

	test("turning tracking on counts a balance no ledger row explains", () => {
		expect(balanceIncreaseDeposit(untracked(699.95), tracked(699.95))).toBe(699.95);
	});

	test("turning tracking on leaves out money its ledger rows already count", () => {
		// 699.95 balance: 200 deposited through rows, 499.95 set by hand.
		expect(balanceIncreaseDeposit(untracked(699.95), tracked(699.95), 200)).toBe(499.95);
	});

	test("turning tracking off and on again records nothing more", () => {
		// The first switch-on recorded a 699.95 "Balance update" row, so the rows now explain it all.
		expect(balanceIncreaseDeposit(untracked(699.95), tracked(699.95), 699.95)).toBeNull();
	});

	test("turning tracking on while changing the balance counts the new unexplained balance", () => {
		expect(balanceIncreaseDeposit(untracked(699.95), tracked(1000))).toBe(1000);
		expect(balanceIncreaseDeposit(untracked(699.95), tracked(1000), 300)).toBe(700);
	});

	test("rows that explain more than the balance record nothing", () => {
		// 1,000 deposited, then the balance was lowered by hand to 600.
		expect(balanceIncreaseDeposit(untracked(600), tracked(600), 1000)).toBeNull();
	});

	test("turning tracking off records nothing", () => {
		expect(balanceIncreaseDeposit(tracked(699.95), untracked(1000))).toBeNull();
	});

	test("turning tracking on for an empty account records nothing", () => {
		expect(balanceIncreaseDeposit(untracked(0), tracked(0))).toBeNull();
	});
});
