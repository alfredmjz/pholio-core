export type CsvValue = string | number | boolean | null | undefined;

function escapeCell(value: CsvValue): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	// Spreadsheets run text starting with these as a formula, so it's prefixed to stay text.
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV text with a header row, in the column order given. */
export function toCsv<T extends Record<string, CsvValue>>(rows: T[], columns: (keyof T & string)[]): string {
	const lines = [columns.map(escapeCell).join(",")];
	for (const row of rows) lines.push(columns.map((column) => escapeCell(row[column])).join(","));
	return lines.join("\r\n") + "\r\n";
}
