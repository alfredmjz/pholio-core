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
