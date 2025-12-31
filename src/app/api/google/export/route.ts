import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";
import { format } from "date-fns";
import { Logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
	try {
		const supabase = await createClient();

		// 1. Get User (Security: prefer getUser over getSession for RLS contexts)
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();

		if (userError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get session for provider token
		const {
			data: { session },
		} = await supabase.auth.getSession();

		// 2. Parse Request Body
		const body = await req.json();
		const { startYear, startMonth, endYear, endMonth, startDate: reqStartDate, endDate: reqEndDate, token } = body;

		// Prefer passed token, fallback to session token
		const accessToken = token || session?.provider_token;

		if (!accessToken) {
			return NextResponse.json(
				{ error: "Google account not linked or session missing provider token" },
				{ status: 401 }
			);
		}

		let startDate: Date;
		let nextMonthStart: Date;

		if (reqStartDate && reqEndDate) {
			startDate = new Date(reqStartDate);
			// For end date, we want to include the full day, so we might need to adjust logic
			// If it's just a date string "YYYY-MM-DD", let's assume end meant inclusive, but our logic uses LT (less than).
			// So if end date is Jan 31, we want < Feb 1.
			// Or just set time to 23:59:59?
			// Simpler: use the next day for LT logic if we want inclusive.
			// If reqEndDate is "2024-01-31", new Date is 2024-01-31 00:00.
			// Users usually expect "End Date" to be inclusive.
			// So we add 1 day to the parsed date for the exclusive upper bound.
			const parsedEnd = new Date(reqEndDate);
			nextMonthStart = new Date(parsedEnd);
			nextMonthStart.setDate(nextMonthStart.getDate() + 1);
		} else {
			if (!startYear || !startMonth || !endYear || !endMonth) {
				return NextResponse.json({ error: "Missing date range parameters" }, { status: 400 });
			}
			// Date Logic for Month/Year:
			// startMonth is 1-based.
			startDate = new Date(startYear, startMonth - 1, 1);
			nextMonthStart = new Date(endYear, endMonth, 1);
		}

		const startStr = format(startDate, "yyyy-MM-dd");
		const endStr = format(nextMonthStart, "yyyy-MM-dd");

		// Count TOTAL likely visible transactions for debug (Removed verbose log)
		const { count: totalCount } = await supabase.from("transactions").select("*", { count: "exact", head: true });

		const { data: transactions, error: dbError } = await supabase
			.from("transactions")
			.select(
				`
            *,
            category:allocation_categories(name)
        `
			)
			.gte("transaction_date", startStr)
			.lt("transaction_date", endStr)
			.order("transaction_date", { ascending: false });

		if (dbError) {
			Logger.error("Database error fetching transactions", { error: dbError });
			return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
		}

		if (!transactions || transactions.length === 0) {
			// Return 404 but clearer message if totalCount > 0
			const msg =
				totalCount && totalCount > 0
					? "No transactions found for selected range (but data exists in account)"
					: "No transactions found (Account appears empty)";
			return NextResponse.json({ error: msg }, { status: 404 });
		}

		// 4. Initialize Google Sheets API
		const auth = new google.auth.OAuth2();
		auth.setCredentials({ access_token: accessToken });
		const sheets = google.sheets({ version: "v4", auth });

		// 5. Create Spreadsheet
		let title = "";
		if (reqStartDate && reqEndDate) {
			title = `Pholio:Budget Report ${reqStartDate} to ${reqEndDate}`;
		} else {
			const monthName = format(startDate, "MMMM");
			title = `Pholio:Budget Report ${monthName} ${startYear}`;
		}

		const spreadsheet = await sheets.spreadsheets.create({
			requestBody: {
				properties: {
					title,
				},
			},
		});

		const spreadsheetId = spreadsheet.data.spreadsheetId;
		const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

		if (!spreadsheetId) {
			throw new Error("Failed to create spreadsheet");
		}

		// 6. Format Data
		const values = [["Date", "Description", "Category", "Amount", "Type", "Is Recurring"]];

		transactions.forEach((t: any) => {
			values.push([
				format(new Date(t.transaction_date), "yyyy-MM-dd"),
				t.description || t.name,
				t.category?.name || "Uncategorized",
				t.amount,
				t.type || (Number(t.amount) < 0 ? "expense" : "income"),
				t.is_recurring ? "Yes" : "No",
			]);
		});

		// 7. Write Data
		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range: "Sheet1!A1",
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values,
			},
		});

		// 8. Basic Formatting
		await sheets.spreadsheets.batchUpdate({
			spreadsheetId,
			requestBody: {
				requests: [
					{
						repeatCell: {
							range: {
								sheetId: 0,
								startRowIndex: 0,
								endRowIndex: 1,
							},
							cell: {
								userEnteredFormat: {
									textFormat: { bold: true },
								},
							},
							fields: "userEnteredFormat.textFormat.bold",
						},
					},
				],
			},
		});

		return NextResponse.json({ url: spreadsheetUrl });
	} catch (error: unknown) {
		Logger.error("Export API Error", { error, statusCode: 500 });
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Internal Server Error" },
			{ status: 500 }
		);
	}
}
