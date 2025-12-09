import { supabase } from "@/lib/supabase/client";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export type ExportRange = {
	type: "current" | "custom";
	startYear: number;
	startMonth: number;
	endYear: number;
	endMonth: number;
};

interface ExportTransaction {
	Date: string;
	Description: string;
	Category: string;
	Amount: number;
	Type: string;
	"Is Recurring": string;
}

export async function exportTransactions(range: ExportRange, filename: string = "transactions") {
	// Use the shared supabase instance

	// Calculate start and end dates based on range
	const startDate = new Date(range.startYear, range.startMonth - 1, 1);
	// For end date, we want the last day of the end month
	// new Date(year, month, 0) gives the last day of the previous month
	// So we use endMonth (which is 1-indexed, so it points to next month in 0-indexed Date) and day 0
	const endDate = new Date(range.endYear, range.endMonth, 0);

	// Fetch transactions
	const { data: transactions, error } = await supabase
		.from("transactions")
		.select(
			`
      *,
      category:allocation_categories(name)
    `
		)
		.gte("transaction_date", startDate.toISOString().split("T")[0])
		.lte("transaction_date", endDate.toISOString().split("T")[0])
		.order("transaction_date", { ascending: false });

	if (error) {
		console.error("Error fetching transactions for export:", error);
		throw new Error("Failed to fetch transactions");
	}

	if (!transactions || transactions.length === 0) {
		throw new Error("No transactions found for the selected range");
	}

	// Format data for export
	const exportData: ExportTransaction[] = transactions.map((t: any) => ({
		Date: format(new Date(t.transaction_date), "yyyy-MM-dd"),
		Description: t.description || t.name,
		Category: t.category?.name || "Uncategorized",
		Amount: Number(t.amount),
		Type: t.type || (Number(t.amount) < 0 ? "expense" : "income"),
		"Is Recurring": t.is_recurring ? "Yes" : "No",
	}));

	// Create workbook and worksheet
	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.json_to_sheet(exportData);

	// Add worksheet to workbook
	XLSX.utils.book_append_sheet(wb, ws, "Transactions");

	// Generate file and trigger download
	const finalFilename = filename.match(/\.(xlsx|xlr|csv)$/) ? filename : `${filename}.xlsx`;

	XLSX.writeFile(wb, finalFilename);
}
