import { formatMoney } from "@/lib/format";

/** Money in the user's default currency and number format (e.g. "$1,234"). */
export function formatCurrency(
	value: number,
	options?: {
		showCents?: boolean;
		showSign?: boolean;
		currency?: string;
	}
): string {
	return formatMoney(value, options);
}
