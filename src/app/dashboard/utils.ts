/**
 * Formatting Utility Functions
 * Currency, date, and number formatting helpers for the application
 */

/**
 * Format a number as Canadian currency
 * @param value - The numeric value to format
 * @param options - Optional formatting options
 * @returns Formatted currency string (e.g., "$1,234")
 */
export function formatCurrency(
	value: number,
	options?: {
		showCents?: boolean;
		showSign?: boolean;
	}
): string {
	const { showCents = false, showSign = false } = options || {};

	const formatted = new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: "CAD",
		minimumFractionDigits: showCents ? 2 : 0,
		maximumFractionDigits: showCents ? 2 : 0,
	}).format(Math.abs(value));

	if (showSign && value !== 0) {
		return value > 0 ? `+${formatted}` : `-${formatted}`;
	}

	return value < 0 ? `-${formatted.replace("-", "")}` : formatted;
}

/**
 * Format a number as compact currency (e.g., $1.2M, $45k)
 * @param value - The numeric value to format
 * @returns Compact formatted string
 */
export function formatCompactCurrency(value: number): string {
	const absValue = Math.abs(value);
	const sign = value < 0 ? "-" : "";

	if (absValue >= 1_000_000) {
		return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`;
	}
	if (absValue >= 1_000) {
		return `${sign}$${(absValue / 1_000).toFixed(0)}k`;
	}
	return `${sign}$${absValue.toFixed(0)}`;
}

/**
 * Format a percentage value
 * @param value - The percentage value (e.g., 12.5 for 12.5%)
 * @param decimals - Number of decimal places (default: 1)
 * @param showSign - Whether to show + for positive values
 * @returns Formatted percentage string
 */
export function formatPercentage(
	value: number,
	decimals: number = 1,
	showSign: boolean = false
): string {
	const formatted = `${value.toFixed(decimals)}%`;
	if (showSign && value > 0) {
		return `+${formatted}`;
	}
	return formatted;
}

/**
 * Format a date for display
 * @param date - Date string in ISO format (YYYY-MM-DD) or Date object
 * @param format - Output format ('short', 'medium', 'long', 'month', 'monthYear')
 * @returns Formatted date string
 */
export function formatDate(
	date: string | Date,
	format: "short" | "medium" | "long" | "month" | "monthYear" = "short"
): string {
	const d = typeof date === "string" ? new Date(date) : date;

	switch (format) {
		case "short":
			return d.toLocaleDateString("en-CA", {
				month: "short",
				day: "numeric",
			});
		case "medium":
			return d.toLocaleDateString("en-CA", {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		case "long":
			return d.toLocaleDateString("en-CA", {
				month: "long",
				day: "numeric",
				year: "numeric",
			});
		case "month":
			return d.toLocaleDateString("en-CA", { month: "short" });
		case "monthYear":
			return d.toLocaleDateString("en-CA", {
				month: "short",
				year: "numeric",
			});
		default:
			return typeof date === "string" ? date : date.toISOString().split("T")[0];
	}
}

/**
 * Get the start and end dates for a period
 * @param period - The period type ('month', 'quarter', 'year')
 * @param referenceDate - Reference date (defaults to current date)
 * @returns Object with startDate and endDate as ISO strings
 */
export function getPeriodDates(
	period: "month" | "quarter" | "year",
	referenceDate: Date = new Date()
): { startDate: string; endDate: string } {
	const year = referenceDate.getFullYear();
	const month = referenceDate.getMonth();

	let startDate: Date;
	let endDate: Date;

	switch (period) {
		case "month":
			startDate = new Date(year, month, 1);
			endDate = new Date(year, month + 1, 0);
			break;
		case "quarter":
			const quarter = Math.floor(month / 3);
			startDate = new Date(year, quarter * 3, 1);
			endDate = new Date(year, quarter * 3 + 3, 0);
			break;
		case "year":
			startDate = new Date(year, 0, 1);
			endDate = new Date(year, 11, 31);
			break;
	}

	return {
		startDate: startDate.toISOString().split("T")[0],
		endDate: endDate.toISOString().split("T")[0],
	};
}

/**
 * Calculate percentage change between two values
 * @param current - Current value
 * @param previous - Previous value
 * @returns Percentage change
 */
export function calculatePercentageChange(
	current: number,
	previous: number
): number {
	if (previous === 0) {
		return current === 0 ? 0 : 100;
	}
	return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Determine trend direction based on percentage change
 * @param change - Percentage change value
 * @param threshold - Threshold for neutral (default: 0.5%)
 * @returns Trend direction
 */
export function getTrendDirection(
	change: number,
	threshold: number = 0.5
): "up" | "down" | "neutral" {
	if (change > threshold) return "up";
	if (change < -threshold) return "down";
	return "neutral";
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Generate a consistent color from a string (for items without custom colors)
 * @param str - String to hash (e.g., account ID)
 * @returns HSL color string
 */
export function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}

	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 65%, 50%)`;
}
