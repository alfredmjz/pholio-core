import { afterEach, describe, expect, test } from "bun:test";
import {
	CURRENCIES,
	DEFAULT_FORMAT_SETTINGS,
	formatDateParts,
	formatMoney,
	getCurrencySymbol,
	getLocaleOptions,
	setFormatSettings,
	toFormatSettings,
} from "@/lib/format";
import { formatCurrency } from "@/app/dashboard/utils";
import { formatShortDate } from "@/lib/date-utils";

// French formats group thousands with a no-break space; compare with plain spaces.
const plain = (value: string) => value.replace(/\s/g, " ");

afterEach(() => setFormatSettings(DEFAULT_FORMAT_SETTINGS));

describe("formatMoney", () => {
	test("defaults to Canadian dollars in the Canadian English format", () => {
		expect(formatMoney(1234.5)).toBe("$1,235");
		expect(formatMoney(1234.5, { showCents: true })).toBe("$1,234.50");
		expect(formatMoney(-50, { showCents: true })).toBe("-$50.00");
		expect(formatMoney(25, { showSign: true })).toBe("+$25");
		expect(formatMoney(0, { showSign: true })).toBe("$0");
	});

	test("follows the user's settings", () => {
		setFormatSettings({ locale: "fr-CA", currency: "CAD" });
		expect(plain(formatMoney(1234.56, { showCents: true }))).toBe("1 234,56 $");

		setFormatSettings({ locale: "fr-FR", currency: "EUR" });
		expect(plain(formatMoney(1234.56, { showCents: true }))).toBe("1 234,56 €");
		expect(plain(formatMoney(-5))).toBe("-5 €");
	});

	test("an amount's own currency wins over the default", () => {
		expect(formatMoney(10, { currency: "USD" })).toBe("US$10");
		setFormatSettings({ locale: "en-US", currency: "USD" });
		expect(formatMoney(1234.56, { showCents: true, currency: "CAD" })).toBe("CA$1,234.56");
	});

	test("yen never shows cents", () => {
		expect(formatMoney(1234.56, { showCents: true, currency: "JPY" })).toBe("JP¥1,235");
	});

	test("compact amounts keep one decimal from a thousand up, none below", () => {
		expect(formatMoney(1_250_000, { compact: true })).toBe("$1.3M");
		expect(formatMoney(45_200, { compact: true })).toBe("$45.2K");
		expect(formatMoney(12.5, { compact: true })).toBe("$13");
		expect(formatMoney(-2_000, { compact: true })).toBe("-$2K");
	});
});

test("the existing helpers pick up the settings", () => {
	setFormatSettings({ locale: "en-GB", currency: "GBP" });
	expect(formatCurrency(1500, { showCents: true })).toBe("£1,500.00");
	expect(formatShortDate("2026-01-31")).toBe("31 Jan");
});

test("dates follow the locale's order and month names", () => {
	const date = new Date(2026, 0, 31);
	const options = { month: "short", day: "numeric", year: "numeric" } as const;
	expect(formatDateParts(date, options)).toBe("Jan 31, 2026");
	expect(formatDateParts(date, options, "en-GB")).toBe("31 Jan 2026");
	expect(plain(formatDateParts(date, options, "fr-FR"))).toBe("31 janv. 2026");
});

test("the amount field prefix is the default currency's symbol", () => {
	expect(getCurrencySymbol()).toBe("$");
	setFormatSettings({ locale: "fr-FR", currency: "EUR" });
	expect(getCurrencySymbol()).toBe("€");
});

describe("toFormatSettings", () => {
	test("keeps known values", () => {
		expect(toFormatSettings("fr-CA", "USD")).toEqual({ locale: "fr-CA", currency: "USD" });
	});

	test("falls back to en-CA and CAD for missing or unknown values", () => {
		expect(toFormatSettings(undefined, null)).toEqual({ locale: "en-CA", currency: "CAD" });
		expect(toFormatSettings("de-DE", "BTC")).toEqual({ locale: "en-CA", currency: "CAD" });
	});
});

test("the pickers list every option alphabetically", () => {
	const locales = getLocaleOptions(new Date(2026, 0, 31));
	expect(locales.map((option) => option.label)).toEqual([
		"English (Canada)",
		"English (United Kingdom)",
		"English (United States)",
		"French (Canada)",
		"French (France)",
	]);
	expect(locales[1].example).toBe("1,234.56 · 31 Jan 2026");
	expect(plain(locales[4].example)).toBe("1 234,56 · 31 janv. 2026");

	expect(CURRENCIES).toEqual(["AUD", "CAD", "EUR", "GBP", "JPY", "USD"]);
});
