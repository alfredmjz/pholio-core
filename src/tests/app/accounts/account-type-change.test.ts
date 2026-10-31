import { describe, expect, test } from "bun:test";
import {
	applyTypeChange,
	canChangeAccountType,
	clearHiddenFields,
	describeTypeChange,
	getTypeChangeOptions,
	isMovingIntoInvestment,
	toFieldConfig,
} from "@/app/accounts/account-type-change";
import { getFieldVisibility } from "@/app/accounts/field-visibility";
import { sampleAccountTypes } from "@/mock-data/accounts";
import type { AccountTypeCode } from "@/app/accounts/types";

const byCode = (code: AccountTypeCode, accountClass: "asset" | "liability" = "asset") =>
	sampleAccountTypes.find((type) => type.code === code && type.class === accountClass)!;

const chequing = byCode("chequing");
const savings = byCode("savings");
const investment = byCode("investment");
const otherAsset = byCode("other");
const card = byCode("credit_card", "liability");
const lineOfCredit = byCode("line_of_credit", "liability");
const mortgage = byCode("mortgage", "liability");
const loan = byCode("loan", "liability");
const otherLiability = byCode("other", "liability");

describe("getTypeChangeOptions", () => {
	test("offers only types of the same class, alphabetically with Other last", () => {
		expect(getTypeChangeOptions(sampleAccountTypes, chequing).map((type) => type.name)).toEqual([
			"Chequing",
			"Investment",
			"Savings",
			"Other (Asset)",
		]);
		expect(getTypeChangeOptions(sampleAccountTypes, card).map((type) => type.code)).toEqual([
			"credit_card",
			"line_of_credit",
			"loan",
			"mortgage",
			"other",
		]);
	});

	test("skips retired and uncoded types but keeps the current one", () => {
		const legacy = { ...savings, id: "legacy", name: "Retirement", code: null, category: "investment" as const };
		const retired = { ...savings, id: "retired", name: "Old Savings", is_active: false };
		const options = getTypeChangeOptions([...sampleAccountTypes, legacy, retired], legacy);
		expect(options.map((type) => type.id)).toContain("legacy");
		expect(options.map((type) => type.id)).not.toContain("retired");
		expect(options.filter((type) => type.code === null)).toHaveLength(1);
	});
});

describe("canChangeAccountType", () => {
	test("blocks a change between asset and liability", () => {
		expect(canChangeAccountType(chequing, card)).toBe(false);
		expect(canChangeAccountType(mortgage, savings)).toBe(false);
		expect(canChangeAccountType(chequing, investment)).toBe(true);
		expect(canChangeAccountType(card, otherLiability)).toBe(true);
	});

	test("blocks retired and uncoded types", () => {
		expect(canChangeAccountType(chequing, { ...savings, is_active: false })).toBe(false);
		expect(canChangeAccountType(chequing, { ...savings, code: null })).toBe(false);
	});
});

describe("clearHiddenFields", () => {
	test("a chequing account keeps its interest rate and overdraft terms", () => {
		expect(clearHiddenFields(getFieldVisibility(chequing))).toEqual({
			target_balance: null,
			credit_limit: null,
			original_amount: null,
			loan_term_months: null,
			payment_due_date: null,
			statement_day: null,
			over_limit_fee: null,
			track_contribution_room: false,
			contribution_plan: null,
			contribution_room: null,
			contribution_room_as_of: null,
			annual_contribution_limit: null,
		});
	});

	test("a line of credit drops the card's statement day and due date but keeps its rate and limit", () => {
		const cleared = clearHiddenFields(getFieldVisibility(lineOfCredit));
		expect(cleared.statement_day).toBeNull();
		expect(cleared.payment_due_date).toBeNull();
		expect("interest_rate" in cleared).toBe(false);
		expect("credit_limit" in cleared).toBe(false);
		expect("over_limit_fee" in cleared).toBe(false);
	});

	test("an Other account that tracks a credit limit keeps the rate shown beside it", () => {
		const cleared = clearHiddenFields(getFieldVisibility(otherLiability, { showCreditLimit: true }));
		expect("interest_rate" in cleared).toBe(false);
		expect(cleared.payment_due_date).toBeNull();
	});
});

describe("applyTypeChange", () => {
	const input = { name: "Everyday", interest_rate: 0.02, field_visibility: null };

	test("passes an unchanged type straight through", () => {
		expect(applyTypeChange(input, savings, savings)).toBe(input);
	});

	test("refuses a class change, a missing type and a retired type", () => {
		expect(applyTypeChange(input, savings, card)).toBeNull();
		expect(applyTypeChange(input, savings, null)).toBeNull();
		expect(applyTypeChange(input, savings, { ...chequing, is_active: false })).toBeNull();
	});

	test("savings to chequing keeps the rate, clears the target and sets the new type", () => {
		const result = applyTypeChange({ ...input, target_balance: 5000 }, savings, chequing)!;
		expect(result.account_type_id).toBe(chequing.id);
		expect(result.interest_rate).toBe(0.02);
		expect(result.target_balance).toBeNull();
		expect(result.field_visibility).toBeNull();
		expect(result.name).toBe("Everyday");
	});

	test("chequing to investment stops overdraft fees and keeps room tracking the user turned on", () => {
		const result = applyTypeChange(
			{ ...input, overdraft_protection: true, nsf_fee: 45, track_contribution_room: true, contribution_plan: "tfsa" },
			chequing,
			investment
		)!;
		expect(result.overdraft_protection).toBe(false);
		expect(result.nsf_fee).toBeNull();
		expect(result.track_contribution_room).toBe(true);
		expect(result.contribution_plan).toBe("tfsa");
	});

	test("investment to savings stops contribution room tracking", () => {
		const result = applyTypeChange({ track_contribution_room: true, contribution_plan: "tfsa" }, investment, savings)!;
		expect(result.track_contribution_room).toBe(false);
		expect(result.contribution_plan).toBeNull();
	});

	test("moving to Other uses the chosen fields, or else the old type's fields", () => {
		const chosen = applyTypeChange({ field_visibility: { showInterestRate: true } }, savings, otherAsset)!;
		expect(chosen.field_visibility).toEqual({ showInterestRate: true });
		expect(chosen.target_balance).toBeNull();
		expect("interest_rate" in chosen).toBe(false);

		const seeded = applyTypeChange({}, card, otherLiability)!;
		expect(seeded.field_visibility).toEqual(toFieldConfig(getFieldVisibility(card)));
		expect("credit_limit" in seeded).toBe(false);
		// "Other" has no statement day field, so the card's day goes.
		expect(seeded.statement_day).toBeNull();
	});

	test("moving away from Other drops its field set", () => {
		const result = applyTypeChange({ field_visibility: { showLoanTerm: true } }, otherLiability, loan)!;
		expect(result.field_visibility).toBeNull();
		expect("loan_term_months" in result).toBe(false);
	});
});

describe("describeTypeChange", () => {
	test("says nothing when the type is unchanged", () => {
		expect(describeTypeChange({}, savings, savings, getFieldVisibility(savings))).toEqual([]);
	});

	test("warns about fees moving in and the balance meaning moving out of investment", () => {
		expect(isMovingIntoInvestment(savings, investment)).toBe(true);
		expect(isMovingIntoInvestment(investment, investment)).toBe(false);
		expect(describeTypeChange({}, savings, investment, getFieldVisibility(investment))[0]).toContain(
			"account fees"
		);
		expect(describeTypeChange({}, investment, savings, getFieldVisibility(savings))[0]).toContain(
			"Update it to what's in the account now"
		);
	});

	test("lists only the saved figures the new type drops", () => {
		const account = { interest_rate: 0.1999, credit_limit: 5000, statement_day: 3, payment_due_date: 24 };
		expect(describeTypeChange(account, card, lineOfCredit, getFieldVisibility(lineOfCredit))).toEqual([
			"Clears the saved payment due date and statement day.",
		]);
		expect(describeTypeChange(account, card, mortgage, getFieldVisibility(mortgage))).toEqual([
			"Clears the saved credit limit and statement day.",
		]);
		expect(describeTypeChange({ nsf_fee: null }, chequing, savings, getFieldVisibility(savings))).toEqual([]);
	});
});
