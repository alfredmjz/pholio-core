import { getDaysInMonth } from "@/lib/date-utils";

export interface MonthRange {
	startYear: number;
	startMonth: number;
	endYear: number;
	endMonth: number;
}

/** What the export needs from a budget transaction. */
export interface ExportTransaction {
	transaction_date: string;
	name: string;
	amount: number;
	source: string;
	recurring_expense_id?: string | null;
	category_name?: string | null;
}

export const EXPORT_HEADERS = ["Date", "Description", "Category", "Amount", "Type", "Is Recurring"] as const;

export type ExportRow = [string, string, string, number, "income" | "expense" | "transfer", "Yes" | "No"];

export const MAX_EXPORT_MONTHS = 120;

const pad = (n: number) => String(n).padStart(2, "0");

export function monthsInRange({ startYear, startMonth, endYear, endMonth }: MonthRange): number {
	return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
}

/** First day of the start month to the last day of the end month, as YYYY-MM-DD. */
export function rangeDates(range: MonthRange): { startDate: string; endDate: string } {
	const lastDay = getDaysInMonth(range.endYear, range.endMonth);
	return {
		startDate: `${range.startYear}-${pad(range.startMonth)}-01`,
		endDate: `${range.endYear}-${pad(range.endMonth)}-${pad(lastDay)}`,
	};
}

/** Newest first; the date is the stored YYYY-MM-DD, never re-parsed. Positive amounts are income. */
export function toExportRows(transactions: ExportTransaction[]): ExportRow[] {
	return [...transactions]
		.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
		.map((t) => {
			const amount = Number(t.amount);
			const type = t.source === "transfer" ? "transfer" : amount > 0 ? "income" : "expense";
			return [
				t.transaction_date,
				t.name,
				t.category_name || "Uncategorized",
				amount,
				type,
				t.recurring_expense_id ? "Yes" : "No",
			];
		});
}

export function exportFilename(range: MonthRange): string {
	const start = `${pad(range.startMonth)}_${range.startYear}`;
	const end = `${pad(range.endMonth)}_${range.endYear}`;
	return start === end ? `pholio_export_${start}.xlsx` : `pholio_export_${start}_to_${end}.xlsx`;
}
