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
