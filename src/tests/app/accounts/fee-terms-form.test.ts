import { describe, expect, test } from "bun:test";
import { getFieldVisibility } from "@/app/accounts/field-visibility";
import { EMPTY_FEE_TERMS_VALUES, toFeeTermsInput, toFeeTermsValues } from "@/app/accounts/fee-terms-form";

const chequing = getFieldVisibility({ code: "chequing" });
const card = getFieldVisibility({ code: "credit_card" });
const mortgage = getFieldVisibility({ code: "mortgage" });

describe("field visibility", () => {
	test("bank accounts show overdraft fields, cards and lines of credit the over-limit fee", () => {
		expect([chequing.showOverdraft, getFieldVisibility({ code: "savings" }).showOverdraft]).toEqual([true, true]);
		expect([card.showOverLimitFee, getFieldVisibility({ code: "line_of_credit" }).showOverLimitFee]).toEqual([
			true,
			true,
		]);
		expect([mortgage.showOverdraft, mortgage.showOverLimitFee, chequing.showOverLimitFee]).toEqual([
			false,
			false,
			false,
		]);
	});

	test("Other accounts opt in", () => {
		expect(getFieldVisibility({ code: "other" }, { showOverdraft: true }).showOverdraft).toBe(true);
		expect(getFieldVisibility({ code: "other" }, {}).showOverdraft).toBe(false);
	});
});

describe("toFeeTermsInput", () => {
	const filled = {
		overdraft_protection: true,
		overdraft_limit: "500",
		overdraft_fee: "5",
		nsf_fee: "48",
		overdraft_interest_rate: "21.99",
		over_limit_fee: "29",
	};

	test("a protected chequing account saves the overdraft terms, the rate as a fraction", () => {
		expect(toFeeTermsInput(filled, chequing)).toEqual({
			overdraft_protection: true,
			overdraft_limit: 500,
			overdraft_fee: 5,
			nsf_fee: 48,
			overdraft_interest_rate: 0.2199,
			over_limit_fee: null,
		});
	});

	test("without protection only the NSF fee is kept", () => {
		expect(toFeeTermsInput({ ...filled, overdraft_protection: false }, chequing)).toEqual({
			overdraft_protection: false,
			overdraft_limit: null,
			overdraft_fee: null,
			nsf_fee: 48,
			overdraft_interest_rate: null,
			over_limit_fee: null,
		});
	});

	test("a card keeps only the over-limit fee; a mortgage keeps nothing", () => {
		expect(toFeeTermsInput(filled, card)).toMatchObject({
			overdraft_protection: false,
			nsf_fee: null,
			over_limit_fee: 29,
		});
		expect(Object.values(toFeeTermsInput(filled, mortgage)).every((value) => value === null || value === false)).toBe(
			true
		);
	});

	test("blank fields save as null", () => {
		expect(toFeeTermsInput(EMPTY_FEE_TERMS_VALUES, chequing).nsf_fee).toBeNull();
	});
});

describe("toFeeTermsValues", () => {
	test("reads a saved account back into the form, the rate as a percentage", () => {
		expect(
			toFeeTermsValues({
				overdraft_protection: true,
				overdraft_limit: 500,
				overdraft_fee: 5,
				nsf_fee: 48,
				overdraft_interest_rate: 0.2199,
				over_limit_fee: null,
			})
		).toEqual({ ...EMPTY_FEE_TERMS_VALUES, ...filledStrings() });
	});

	test("an account with nothing set is the empty form", () => {
		expect(toFeeTermsValues({})).toEqual(EMPTY_FEE_TERMS_VALUES);
	});
});

function filledStrings() {
	return {
		overdraft_protection: true,
		overdraft_limit: "500",
		overdraft_fee: "5",
		nsf_fee: "48",
		overdraft_interest_rate: "21.99",
	};
}
