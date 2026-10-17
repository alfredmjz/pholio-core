export function formatCompactCurrency(amount: number): string {
	const sign = amount < 0 ? "-" : "";
	const absolute = Math.abs(amount);

	const compact = (value: number, suffix: string) => {
		const rounded = Math.round(value * 10) / 10;
		const display = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
		return `${sign}$${display}${suffix}`;
	};

	if (absolute >= 1_000_000) return compact(absolute / 1_000_000, "M");
	if (absolute >= 1_000) return compact(absolute / 1_000, "K");
	return `${sign}$${Math.round(absolute)}`;
}
