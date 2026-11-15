import writeExcelFile from "write-excel-file/browser";
import type { ExportRow } from "../export-rows";

/** Writes rows the server already prepared into an .xlsx download. */
export async function downloadExcel(headers: string[], rows: ExportRow[], filename: string) {
	await writeExcelFile([headers, ...rows], { sheet: "Transactions" }).toFile(filename);
}
