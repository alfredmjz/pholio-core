/**
 * Anchor date for demo data.
 *
 * Demo data must stay "current" no matter when a visitor runs the demo, so every
 * generator takes a `now` value and defaults to the time it is called (request
 * time on the server, render time on the client). Set `DEMO_DATE` (server-only,
 * e.g. `2026-10-15`) to make the demo deterministic for screenshots/tests.
 */
export function getDemoNow(): Date {
	const override = process.env.DEMO_DATE;
	if (override) {
		const parsed = new Date(override);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return new Date();
}

/** Returns a new Date `days` before `now`. */
export function daysBefore(now: Date, days: number): Date {
	const d = new Date(now);
	d.setDate(d.getDate() - days);
	return d;
}

/** Formats a date as `YYYY-MM-DD` in local time (no timezone shift). */
export function toDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
