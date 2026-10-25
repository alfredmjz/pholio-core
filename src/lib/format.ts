export const FORMAT_LOCALES = ["en-CA", "en-GB", "en-US", "fr-CA", "fr-FR"] as const;
export type FormatLocale = (typeof FORMAT_LOCALES)[number];

export const CURRENCIES = ["AUD", "CAD", "EUR", "GBP", "JPY", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface FormatSettings {
	locale: FormatLocale;
	currency: Currency;
}

export const DEFAULT_FORMAT_SETTINGS: FormatSettings = { locale: "en-CA", currency: "CAD" };

export function isFormatLocale(value: unknown): value is FormatLocale {
	return FORMAT_LOCALES.includes(value as FormatLocale);
}

export function isCurrency(value: unknown): value is Currency {
	return CURRENCIES.includes(value as Currency);
}

export function toFormatSettings(locale: unknown, currency: unknown): FormatSettings {
	return {
		locale: isFormatLocale(locale) ? locale : DEFAULT_FORMAT_SETTINGS.locale,
		currency: isCurrency(currency) ? currency : DEFAULT_FORMAT_SETTINGS.currency,
	};
}

// Set by FormatProvider while it renders, so every helper formats the way the signed-in user chose.
let current: FormatSettings = DEFAULT_FORMAT_SETTINGS;

export function setFormatSettings(settings: FormatSettings): void {
	current = settings;
}

export interface MoneyOptions {
	showCents?: boolean;
	/** "+" for positive amounts as well as "-" for negative ones. */
	showSign?: boolean;
	/** The amount's own currency; the user's default otherwise. */
	currency?: string;
	compact?: boolean;
	locale?: FormatLocale;
}

export function formatMoney(value: number, options: MoneyOptions = {}): string {
	const { showCents = false, showSign = false, compact = false } = options;
	const locale = options.locale ?? current.locale;
	const currency = options.currency || current.currency;
	// Yen has no minor unit, so it never shows cents.
	const digits = showCents && currency !== "JPY" ? 2 : 0;

	const formatted = new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: compact ? 0 : digits,
		maximumFractionDigits: compact ? (Math.abs(value) >= 1000 ? 1 : 0) : digits,
		notation: compact ? "compact" : "standard",
	}).format(Math.abs(value));

	if (value < 0) return `-${formatted}`;
	if (showSign && value > 0) return `+${formatted}`;
	return formatted;
}

/** The symbol for an amount field's prefix, e.g. "$" or "€". */
export function getCurrencySymbol(currency?: string): string {
	const parts = new Intl.NumberFormat(current.locale, {
		style: "currency",
		currency: currency || current.currency,
		currencyDisplay: "narrowSymbol",
	}).formatToParts(0);
	return parts.find((part) => part.type === "currency")?.value ?? "$";
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}, locale?: FormatLocale): string {
	return new Intl.NumberFormat(locale ?? current.locale, options).format(value);
}

export function formatDateParts(date: Date, options: Intl.DateTimeFormatOptions, locale?: FormatLocale): string {
	return new Intl.DateTimeFormat(locale ?? current.locale, options).format(date);
}

const LOCALE_NAMES: Record<FormatLocale, string> = {
	"en-CA": "English (Canada)",
	"en-GB": "English (United Kingdom)",
	"en-US": "English (United States)",
	"fr-CA": "French (Canada)",
	"fr-FR": "French (France)",
};

export interface FormatOption<T extends string> {
	value: T;
	label: string;
	example: string;
}

/** Already alphabetical by label (ADR-003). */
export function getLocaleOptions(sampleDate: Date): FormatOption<FormatLocale>[] {
	return FORMAT_LOCALES.map((locale) => ({
		value: locale,
		label: LOCALE_NAMES[locale],
		example: `${formatNumber(1234.56, { minimumFractionDigits: 2 }, locale)} · ${formatDateParts(
			sampleDate,
			{ month: "short", day: "numeric", year: "numeric" },
			locale
		)}`,
	}));
}
