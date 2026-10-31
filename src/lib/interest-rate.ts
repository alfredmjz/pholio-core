// Rates are typed as percentages with up to 2 decimals and stored as fractions (DECIMAL(5,4)).
// Scaling through whole hundredths of a percent keeps float noise like 21.990000000000002 out.

/** 0.2199 → "21.99", 0.045 → "4.5"; empty for no rate. */
export function rateToPercentInput(rate: number | null | undefined): string {
	if (rate === null || rate === undefined || !Number.isFinite(Number(rate)) || Number(rate) === 0) return "";
	return String(Math.round(Number(rate) * 10_000) / 100);
}

/** "21.99" → 0.2199; null for an empty or invalid entry. Extra decimals are rounded to 2. */
export function percentInputToRate(value: string): number | null {
	const percent = parseFloat(value);
	if (!Number.isFinite(percent)) return null;
	return Math.round(percent * 100) / 10_000;
}
