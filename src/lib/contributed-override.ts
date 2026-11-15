export type ContributedOverrideResult =
	{ ok: true; amount: number | null; asOf: string | null } | { ok: false; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks the "contributed this year" figure a user types for a plan. A blank amount clears the
 * figure. The date must fall in the current year, on or before today, since the figure covers
 * 1 January up to that date.
 */
export function validateContributedOverride(amount: string, asOf: string, today: string): ContributedOverrideResult {
	const trimmed = amount.trim();
	if (trimmed === "") return { ok: true, amount: null, asOf: null };

	const value = Number(trimmed);
	if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid amount." };
	if (value < 0) return { ok: false, error: "Amount can't be negative." };
	if (!DATE_PATTERN.test(asOf)) return { ok: false, error: "Pick the date this figure runs up to." };
	if (asOf > today) return { ok: false, error: "The date can't be in the future." };
	if (asOf.slice(0, 4) !== today.slice(0, 4)) return { ok: false, error: "Pick a date in this year." };

	return { ok: true, amount: Math.round(value * 100) / 100, asOf };
}
