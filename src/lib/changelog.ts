export interface ChangelogEntry {
	/** Stable key; never reuse one. */
	id: string;
	/** Release day, YYYY-MM-DD. */
	date: string;
	version?: string;
	title: string;
	/** What changed for the user, in plain words. */
	items: string[];
}

/** What's new in Pholio, newest first. Every user-facing release adds an entry at the top. */
export const CHANGELOG: ChangelogEntry[] = [
	{
		id: "2026-10-investments-amount-deposited",
		date: "2026-10-31",
		title: "Investments show the amount you deposited",
		items: [
			"Pholio doesn't connect to your brokerage, so an investment account now shows what you've put in, less withdrawals, instead of a market value that would go out of date.",
			"Deposits, contributions and transfers in add to it, and withdrawals and transfers out take away from it. Interest is no longer added to investment accounts.",
			"If an investment account shows a market value from before, edit the account and enter the amount you've deposited.",
		],
	},
	{
		id: "2026-10-clearer-amount-limits",
		date: "2026-10-28",
		title: "Clearer messages when an amount is too high",
		items: [
			"When an amount is more than an account's balance, the message now says so and shows amounts in your currency format.",
		],
	},
	{
		id: "2026-10-weather-behind-text",
		date: "2026-10-28",
		title: "The weather runs behind your numbers",
		items: [
			"The background weather now flows behind headings, totals, budget bars and charts, instead of stopping around them. It fades softly under words so they stay easy to read.",
		],
	},
	{
		id: "2026-10-account-links",
		date: "2026-10-27",
		title: "Accounts, bills and transactions now connect",
		items: [
			"Choose the account each bill or subscription is paid from. Its payments are recorded on that account for you.",
			"Each account lists the bills it pays, and its transfers name the other account.",
			"Jump from an account's activity to the same transaction in Allocations, and back.",
			"Pay bills early: pick how many upcoming bills to cover and they're recorded today.",
			"Moving between months in Allocations shows a placeholder until the new month loads, and the month picker has a new look.",
			"Fixed: editing a payment no longer says it's more than your balance.",
		],
	},
	{
		id: "2026-10-ascii-logo",
		date: "2026-10-24",
		title: "A new Pholio logo",
		items: [
			"Pholio's logo is now a 3D p drawn in text characters. It sways on the sign-in page and in sign-in and payment-reminder emails.",
		],
	},
	{
		id: "2026-10-onboarding",
		date: "2026-10-24",
		title: "A friendlier first sign-in",
		items: ["New accounts start by telling Pholio what to call you, and your time zone is set for you."],
	},
	{
		id: "2026-10-settings",
		date: "2026-10-24",
		title: "A new Settings page and notifications",
		items: [
			"Every setting is on one page and saves as you change it.",
			"Get payment reminders for credit cards, bills and subscriptions in Pholio, by email, or both.",
			"The bell shows your reminders and what's new in Pholio.",
			"Choose a default currency and how numbers and dates are written.",
			"Download all your data in one CSV file, start over with Reset data, or delete your account.",
		],
	},
	{
		id: "2026-10-weather",
		date: "2026-10-23",
		version: "1.20.0",
		title: "Your finances set the weather",
		items: [
			"The background turns sunny, cloudy, windy or rainy with how your month is going.",
			"Prefer it calm? Pick None or Wind under Settings, Appearance.",
		],
	},
	{
		id: "2026-10-sign-in-links",
		date: "2026-10-23",
		version: "1.19.0",
		title: "Easier sign-in links",
		items: [
			"Didn't get the email? Send another link once the short wait is over.",
			"Typed the wrong address? Go back without losing it.",
		],
	},
	{
		id: "2026-10-paper",
		date: "2026-10-22",
		version: "1.18.0",
		title: "A fresh, calmer look",
		items: [
			"Dashboard, Allocations, Accounts and Recurring have a new paper design.",
			"The Dashboard leads with your net worth and what needs attention.",
		],
	},
	{
		id: "2026-10-contribution-room",
		date: "2026-10-21",
		version: "1.17.0",
		title: "Track your TFSA, RRSP, FHSA and RESP room",
		items: [
			"See how much room is left in each plan, shared across all of its accounts.",
			"Get a warning before a deposit goes over your limit.",
		],
	},
];

/** When the user last looked, or when they signed up if they never have. */
function seenSince(seenAt: string | null, signedUpAt: string): string {
	return (seenAt ?? signedUpAt).slice(0, 10);
}

export function isEntryUnread(entry: ChangelogEntry, seenAt: string | null, signedUpAt: string): boolean {
	return entry.date > seenSince(seenAt, signedUpAt);
}

export function hasUnreadChangelog(seenAt: string | null, signedUpAt: string, entries = CHANGELOG): boolean {
	return entries.some((entry) => isEntryUnread(entry, seenAt, signedUpAt));
}
