/**
 * Date and time utilities for formatting and manipulation
 *
 * This module provides date/time utilities built on date-fns.
 * For functions that exist in date-fns, we re-export them directly.
 * Custom functions are provided for app-specific formatting needs.
 */

import {
	format,
	isToday as dateFnsIsToday,
	isYesterday as dateFnsIsYesterday,
	differenceInMinutes,
	differenceInHours,
	differenceInDays,
	addMonths,
	addYears,
	addWeeks,
} from "date-fns";

// ============================================================================
// Re-exported date-fns functions
// ============================================================================

/**
 * Check if a date is today (re-exported from date-fns)
 */
export const isToday = (date: string | Date): boolean => {
	const d = typeof date === "string" ? new Date(date) : date;
	return dateFnsIsToday(d);
};

/**
 * Check if a date is yesterday (re-exported from date-fns)
 */
export const isYesterday = (date: string | Date): boolean => {
	const d = typeof date === "string" ? new Date(date) : date;
	return dateFnsIsYesterday(d);
};

// ============================================================================
// Formatting functions using date-fns format()
// ============================================================================

/**
 * Format a date as a short date string (e.g., "Jan 4")
 */
export function formatShortDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, "MMM d");
}

/**
 * Format a date with time (e.g., "Jan 4, 3:45 PM")
 */
export function formatDateTime(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, "MMM d, h:mm a");
}

/**
 * Format a full date with year (e.g., "Jan 4, 2025")
 */
export function formatFullDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, "MMM d, yyyy");
}

/**
 * Format time only (e.g., "3:45 PM")
 */
export function formatTime(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, "h:mm a");
}

/**
 * Format month and year (e.g., "January 2025")
 */
export function formatMonthYear(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return format(d, "MMMM yyyy");
}

/**
 * Get today's date as a YYYY-MM-DD string in local timezone.
 * Uses date-fns format which respects local timezone, avoiding the
 * UTC conversion issue with toISOString().
 */
export function getTodayDateString(): string {
	return format(new Date(), "yyyy-MM-dd");
}

// ============================================================================
// Custom functions with app-specific formatting
// ============================================================================

/**
 * Format a timestamp as a human-readable relative time with compact output.
 *
 * This is a custom function because date-fns's formatDistanceToNow produces
 * longer strings like "3 minutes ago" whereas we want compact "3m ago".
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

	const diffMins = differenceInMinutes(now, date);
	const diffHours = differenceInHours(now, date);
	const diffDays = differenceInDays(now, date);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays}d ago`;
	return format(date, "MMM d");
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
	// Ensure we are working with a Date object
	const date = new Date(currentDue);
	switch (frequency) {
		case "monthly":
			return addMonths(date, 1);
		case "yearly":
			return addYears(date, 1);
		case "weekly":
			return addWeeks(date, 1);
		case "biweekly":
			return addWeeks(date, 2);
		default:
			return date;
	}
}

/**
 * Helper to parse a YYYY-MM-DD string into a Local Date object (midnight).
 * This prevents timezone shifts that occur when parsing ISO strings (which default to UTC).
 *
 * @param dateStr - YYYY-MM-DD or ISO string
 * @returns Date object in local time (00:00:00)
 */
export function parseLocalDate(dateStr: string): Date {
	if (!dateStr) return new Date();
	// Handle ISO strings with time components by taking only the date part
	const cleanDateStr = dateStr.split("T")[0];
	const [y, m, d] = cleanDateStr.split("-").map(Number);
	// Return local date at midnight
	return new Date(y, m - 1, d);
}
