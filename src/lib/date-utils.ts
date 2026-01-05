/**
 * Date and time utilities for formatting and manipulation
 */

/**
 * Format a timestamp as a human-readable relative time.
 *
 * @param timestamp - ISO timestamp string or Date object
 * @returns Formatted relative time string
 *
 * @example
 * ```typescript
 * formatRelativeTime(new Date())  // => "Just now"
 * formatRelativeTime("2025-01-04T12:00:00Z")  // => "3h ago" (if now is 3pm)
 * ```
 */
export function formatRelativeTime(timestamp: string | Date): string {
	const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a date as a short date string (e.g., "Jan 4")
 *
 * @param date - Date object or ISO string
 * @returns Formatted date string
 */
export function formatShortDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a date with time (e.g., "Jan 4, 3:45 PM")
 *
 * @param date - Date object or ISO string
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/**
 * Check if a date is today
 *
 * @param date - Date object or ISO string
 * @returns True if the date is today
 */
export function isToday(date: string | Date): boolean {
	const d = typeof date === "string" ? new Date(date) : date;
	const today = new Date();
	return d.toDateString() === today.toDateString();
}

/**
 * Check if a date is yesterday
 *
 * @param date - Date object or ISO string
 * @returns True if the date is yesterday
 */
export function isYesterday(date: string | Date): boolean {
	const d = typeof date === "string" ? new Date(date) : date;
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	return d.toDateString() === yesterday.toDateString();
}

/**
 * Format a full date with year (e.g., "Jan 4, 2025")
 *
 * @param date - Date object or ISO string
 * @returns Formatted date string with year
 */
export function formatFullDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * Format time only (e.g., "3:45 PM")
 *
 * @param date - Date object or ISO string
 * @returns Formatted time string
 */
export function formatTime(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

/**
 * Format month and year (e.g., "January 2025")
 *
 * @param date - Date object or ISO string
 * @returns Formatted month and year string
 */
export function formatMonthYear(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
}
