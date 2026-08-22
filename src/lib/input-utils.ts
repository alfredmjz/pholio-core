/**
 * Input validation and sanitization utilities for currency, amount, and numeric fields.
 */

/**
 * Validates if a string is a valid decimal number with a maximum number of decimal places.
 * Allows for empty strings, integers, and decimals ending with a dot (e.g., "123.").
 *
 * @param value - The input string to validate
 * @param maxDecimals - Maximum number of decimal places allowed (default: 2)
 * @returns true if the value is valid
 */
export function validateDecimalInput(value: string, maxDecimals = 2): boolean {
	if (value === "") return true;
	const regex = new RegExp(`^\\d*(\\.\\d{0,${maxDecimals}})?$`);
	return regex.test(value);
}

/**
 * Sanitizes an input string to contain ONLY numbers and at most one decimal point
 * with up to `maxDecimals` decimal places.
 * Strips out all non-numeric characters (letters, symbols, duplicate dots, spaces).
 *
 * @param value - The input string to sanitize
 * @param maxDecimals - Maximum number of decimal places allowed (default: 2)
 * @returns Cleaned numeric string (e.g., "123.45")
 */
export function sanitizeDecimalInput(value: string, maxDecimals = 2): string {
	if (!value) return "";

	// Remove all characters except digits and decimal points
	let cleaned = value.replace(/[^0-9.]/g, "");

	// Handle multiple decimal points (keep only the first one)
	const firstDotIndex = cleaned.indexOf(".");
	if (firstDotIndex !== -1) {
		const integerPart = cleaned.slice(0, firstDotIndex);
		const decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "").slice(0, maxDecimals);
		cleaned = `${integerPart}.${decimalPart}`;
	}

	return cleaned;
}

/**
 * Sanitizes an input string to contain ONLY positive integers (digits 0-9).
 *
 * @param value - The input string to sanitize
 * @returns Cleaned integer string
 */
export function sanitizeIntegerInput(value: string): string {
	if (!value) return "";
	return value.replace(/[^0-9]/g, "");
}
