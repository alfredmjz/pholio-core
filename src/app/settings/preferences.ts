import { isCurrency, isFormatLocale, type Currency, type FormatLocale } from "@/lib/format";

export const REMINDER_LEAD_DAYS = [1, 3, 7, 14] as const;

export interface UserPreferences {
	defaultCurrency: Currency;
	locale: FormatLocale;
	notifyInApp: boolean;
	notifyEmail: boolean;
	notifyLeadDays: number;
}

type PreferenceColumns = {
	default_currency?: Currency;
	locale?: FormatLocale;
	notify_in_app?: boolean;
	notify_email?: boolean;
	notify_lead_days?: number;
};

/** The users columns to write for a change, or an error naming the first invalid value. */
export function toPreferenceColumns(
	changes: Partial<UserPreferences>
): { columns: PreferenceColumns; error?: undefined } | { columns?: undefined; error: string } {
	const columns: PreferenceColumns = {};

	if (changes.defaultCurrency !== undefined) {
		if (!isCurrency(changes.defaultCurrency)) return { error: "Pick a currency from the list" };
		columns.default_currency = changes.defaultCurrency;
	}
	if (changes.locale !== undefined) {
		if (!isFormatLocale(changes.locale)) return { error: "Pick a format from the list" };
		columns.locale = changes.locale;
	}
	if (changes.notifyInApp !== undefined) {
		if (typeof changes.notifyInApp !== "boolean") return { error: "Invalid reminder setting" };
		columns.notify_in_app = changes.notifyInApp;
	}
	if (changes.notifyEmail !== undefined) {
		if (typeof changes.notifyEmail !== "boolean") return { error: "Invalid reminder setting" };
		columns.notify_email = changes.notifyEmail;
	}
	if (changes.notifyLeadDays !== undefined) {
		if (!REMINDER_LEAD_DAYS.includes(changes.notifyLeadDays as (typeof REMINDER_LEAD_DAYS)[number])) {
			return { error: "Pick how many days ahead from the list" };
		}
		columns.notify_lead_days = changes.notifyLeadDays;
	}

	if (Object.keys(columns).length === 0) return { error: "Nothing to save" };
	return { columns };
}

export function toUserPreferences(row: Partial<Record<keyof Required<PreferenceColumns>, unknown>>): UserPreferences {
	const leadDays = Number(row.notify_lead_days);
	return {
		defaultCurrency: isCurrency(row.default_currency) ? row.default_currency : "CAD",
		locale: isFormatLocale(row.locale) ? row.locale : "en-CA",
		notifyInApp: row.notify_in_app !== false,
		notifyEmail: row.notify_email === true,
		notifyLeadDays: REMINDER_LEAD_DAYS.includes(leadDays as (typeof REMINDER_LEAD_DAYS)[number]) ? leadDays : 3,
	};
}
