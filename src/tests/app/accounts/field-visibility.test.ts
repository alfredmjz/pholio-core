import { describe, expect, test } from "bun:test";
import { getFieldVisibility } from "@/app/accounts/field-visibility";

describe("interest rate visibility", () => {
	test("chequing shows its interest rate beside the separate overdraft fields", () => {
		const chequing = getFieldVisibility({ code: "chequing" });
		expect(chequing.showInterestRate).toBe(true);
		expect(chequing.showOverdraft).toBe(true);
		expect(chequing.interestRateLabel).toBe("Interest Rate (%)");
	});

	test("investments still hide it", () => {
		expect(getFieldVisibility({ code: "investment" }).showInterestRate).toBe(false);
	});
});
