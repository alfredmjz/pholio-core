import { describe, expect, test } from "bun:test";
import { toPreferenceColumns, toUserPreferences } from "@/app/settings/preferences";

describe("toPreferenceColumns", () => {
	test("maps each change to its users column", () => {
		expect(toPreferenceColumns({ defaultCurrency: "USD", locale: "fr-CA" })).toEqual({
			columns: { default_currency: "USD", locale: "fr-CA" },
		});
		expect(toPreferenceColumns({ notifyInApp: false, notifyEmail: true, notifyLeadDays: 7 })).toEqual({
			columns: { notify_in_app: false, notify_email: true, notify_lead_days: 7 },
		});
	});

	test("refuses values outside the lists", () => {
		expect(toPreferenceColumns({ defaultCurrency: "BTC" as never }).error).toBe("Pick a currency from the list");
		expect(toPreferenceColumns({ locale: "de-DE" as never }).error).toBe("Pick a format from the list");
		expect(toPreferenceColumns({ notifyLeadDays: 2 }).error).toBe("Pick how many days ahead from the list");
		expect(toPreferenceColumns({ notifyLeadDays: 30 }).error).toBe("Pick how many days ahead from the list");
		expect(toPreferenceColumns({ notifyEmail: "yes" as never }).error).toBe("Invalid reminder setting");
		expect(toPreferenceColumns({ notifyInApp: 1 as never }).error).toBe("Invalid reminder setting");
	});

	test("an empty change saves nothing", () => {
		expect(toPreferenceColumns({}).error).toBe("Nothing to save");
	});
});

describe("toUserPreferences", () => {
	test("reads the saved columns", () => {
		expect(
			toUserPreferences({
				default_currency: "EUR",
				locale: "fr-FR",
				notify_in_app: false,
				notify_email: true,
				notify_lead_days: 14,
			})
		).toEqual({ defaultCurrency: "EUR", locale: "fr-FR", notifyInApp: false, notifyEmail: true, notifyLeadDays: 14 });
	});

	test("falls back to the column defaults when a row predates migration 009", () => {
		expect(toUserPreferences({})).toEqual({
			defaultCurrency: "CAD",
			locale: "en-CA",
			notifyInApp: true,
			notifyEmail: false,
			notifyLeadDays: 3,
		});
	});
});
