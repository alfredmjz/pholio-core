/**
 * Date utility functions.
 *
 * All formatting uses Intl.DateTimeFormat for locale-aware output.
 * Timezone-aware "today" detection uses Intl.DateTimeFormat with timeZone option.
 * Native Date objects are returned where needed for react-day-picker interop.
 */

// ============================================================================
// Core Parsing & Conversion
// ============================================================================

/**
 * Parse a YYYY-MM-DD string into a Local Date object (midnight).
 * This prevents timezone shifts that occur when parsing ISO strings (which default to UTC).
 *
 * @param dateStr - YYYY-MM-DD or ISO string
 * @returns Date object in local time (00:00:00)
 */
export function parseLocalDate(dateStr: string): Date {
	if (!dateStr) return new Date();

	const cleanDateStr = dateStr.split("T")[0];
	const [y, m, d] = cleanDateStr.split("-").map(Number);
	return new Date(y, m - 1, d);
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a date as "MMM d" (e.g., "Jan 4")
 */
export function formatShortDate(date: string | Date): string {
	const d = typeof date === "string" ? parseLocalDate(date) : date;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a date with time (e.g., "Jan 4, 3:45 PM")
 */
export function formatDateTime(date: string | Date): string {
	const d = typeof date === "string" ? parseLocalDate(date) : date;
	return (
		d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		}) +
		", " +
		d.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
		})
	);
}

/**
 * Format a full date with year (e.g., "Jan 4, 2025")
 */
export function formatFullDate(date: string | Date): string {
	const d = typeof date === "string" ? parseLocalDate(date) : date;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Format time only (e.g., "3:45 PM")
 */
export function formatTime(date: string | Date): string {
	const d = typeof date === "string" ? parseLocalDate(date) : date;
	return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Format month and year (e.g., "January 2025")
 */
export function formatMonthYear(date: string | Date): string {
	const d = typeof date === "string" ? parseLocalDate(date) : date;
	return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Format a date in a long, human-readable form (e.g., "March 11, 2026")
 * Equivalent to date-fns format(date, "PPP")
 */
export function formatLongDate(date: string | Date): string {
	const d = typeof date === "string" ? parseLocalDate(date) : date;
	return d.toLocaleDateString("en-US", { dateStyle: "long" });
}

/**
 * Get today's date string (YYYY-MM-DD) in the given timezone.
 * If no timezone is provided, uses the system default.
 *
 * Uses Intl.DateTimeFormat to resolve the date in the target timezone,
 * then reconstructs the YYYY-MM-DD string from the parts.
 *
 * @param timezone - Optional IANA timezone identifier (e.g., "America/New_York")
 * @returns YYYY-MM-DD string
 */
export function getTodayDateString(timezone?: string): string {
	const now = new Date();

	if (timezone) {
		const formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
		// en-CA formats as YYYY-MM-DD
		return formatter.format(now);
	}

	// Local timezone: use manual extraction to avoid UTC drift
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

// ============================================================================
// Custom functions with app-specific formatting
// ============================================================================

/**
 * Format a timestamp as a human-readable relative time with compact output.
 *
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted relative time string
 *
 * @example
 * ```typescript
 * formatRelativeTime(new Date())  // => "Just now"
 * formatRelativeTime(someDate)    // => "3m ago", "2h ago", "Yesterday", "3d ago", "Jan 4"
 * ```
 */
export function formatRelativeTime(timestamp: string | Date): string {
	const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
	const now = new Date();

	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMs / 3_600_000);
	const diffDays = Math.floor(diffMs / 86_400_000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ============================================================================
// Recurring Date Calculation Helpers
// ============================================================================

/**
 * Calculate the next due date based on frequency.
 *
 * @param currentDue - Date object representing current due date
 * @param frequency - 'monthly', 'yearly', 'weekly', 'biweekly'
 * @returns Next due Date object
 */
export function calculateNextDueDate(currentDue: Date, frequency: string): Date {
	const result = new Date(currentDue);

	switch (frequency) {
		case "monthly":
			result.setMonth(result.getMonth() + 1);
			break;
		case "yearly":
			result.setFullYear(result.getFullYear() + 1);
			break;
		case "weekly":
			result.setDate(result.getDate() + 7);
			break;
		case "biweekly":
			result.setDate(result.getDate() + 14);
			break;
		default:
			return new Date(currentDue);
	}

	return result;
}

/**
 * Format a Date object as a YYYY-MM-DD string using LOCAL time components.
 * This avoids timezone drift from toISOString() which uses UTC.
 *
 * @param date - Date object in local time
 * @returns YYYY-MM-DD string
 */
export function formatDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

// ============================================================================
// Date Calculation Helpers
// ============================================================================

/**
 * Get the number of days in a given month.
 *
 * @param year - Full year (e.g., 2026)
 * @param month - 1-indexed month (1 = January)
 * @returns Number of days in the month
 */
export function getDaysInMonth(year: number, month: number): number {
	// new Date(year, month, 0) gives the last day of the previous month
	// Since month is 1-indexed, new Date(year, month, 0) gives last day of that month
	return new Date(year, month, 0).getDate();
}

/**
 * Check if two dates are in the same month and year.
 */
export function isSameMonth(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Calculate the difference in months between two dates.
 *
 * @param later - The later date
 * @param earlier - The earlier date
 * @returns Number of whole months between the two dates
 */
export function differenceInMonths(later: Date, earlier: Date): number {
	return (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
}
