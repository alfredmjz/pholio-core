import { describe, expect, test } from "bun:test";
import { balanceIncreaseDeposit } from "@/lib/balance-deposit";

describe("balanceIncreaseDeposit", () => {
	test("an opening balance on a tracked account is a deposit of the whole balance", () => {
		expect(balanceIncreaseDeposit(true, 0, 699.95)).toBe(699.95);
	});

	test("raising the balance deposits only the difference", () => {
		expect(balanceIncreaseDeposit(true, 699.95, 1000)).toBe(300.05);
	});

	test("avoids float noise", () => {
		expect(balanceIncreaseDeposit(true, 0.1, 0.3)).toBe(0.2);
	});

	test("lowering or keeping the balance records nothing", () => {
		expect(balanceIncreaseDeposit(true, 500, 400)).toBeNull();
		expect(balanceIncreaseDeposit(true, 500, 500)).toBeNull();
	});

	test("an untracked account records nothing", () => {
		expect(balanceIncreaseDeposit(false, 0, 699.95)).toBeNull();
	});
});
