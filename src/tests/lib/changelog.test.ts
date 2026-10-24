import { describe, expect, test } from "bun:test";
import { CHANGELOG, hasUnreadChangelog, isEntryUnread, type ChangelogEntry } from "@/lib/changelog";
import { notificationHref } from "@/lib/notifications";

const entry = (date: string): ChangelogEntry => ({ id: date, date, title: "Something new", items: ["A change"] });
const entries = [entry("2026-10-24"), entry("2026-10-20")];

describe("changelog unread", () => {
	test("an entry is new when it's dated after the user last opened What's new", () => {
		expect(isEntryUnread(entry("2026-10-24"), "2026-10-21T15:00:00Z", "2026-01-01T00:00:00Z")).toBe(true);
		expect(isEntryUnread(entry("2026-10-20"), "2026-10-21T15:00:00Z", "2026-01-01T00:00:00Z")).toBe(false);
		// Opened on release day: that day's entry counts as seen.
		expect(isEntryUnread(entry("2026-10-24"), "2026-10-24T09:00:00Z", "2026-01-01T00:00:00Z")).toBe(false);
	});

	test("someone who never opened it counts from when they signed up, so history isn't new to them", () => {
		expect(hasUnreadChangelog(null, "2026-10-22T10:00:00Z", entries)).toBe(true);
		expect(hasUnreadChangelog(null, "2026-10-25T10:00:00Z", entries)).toBe(false);
	});

	test("nothing is new once the latest entry has been seen", () => {
		expect(hasUnreadChangelog("2026-10-24T18:00:00Z", "2026-01-01T00:00:00Z", entries)).toBe(false);
	});
});

test("the changelog is newest first, with unique ids and something to say", () => {
	const dates = CHANGELOG.map((e) => e.date);
	expect([...dates].sort().reverse()).toEqual(dates);
	expect(new Set(CHANGELOG.map((e) => e.id)).size).toBe(CHANGELOG.length);
	for (const e of CHANGELOG) {
		expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(e.items.length).toBeGreaterThan(0);
	}
});

test("a card reminder opens the card; a bill or subscription opens Recurring", () => {
	expect(notificationHref({ kind: "card_due", refId: "abc" })).toBe("/accounts/abc");
	expect(notificationHref({ kind: "recurring_due", refId: "abc" })).toBe("/recurring");
});
