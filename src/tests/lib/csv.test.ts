import { expect, test } from "bun:test";
import { toCsv } from "@/lib/csv";
import { buildExportCsv, buildFullExportCsv, exportFilename } from "@/app/settings/data-export";

test("writes a header row and one line per row, in column order", () => {
	expect(toCsv([{ b: 2, a: "x" }], ["a", "b"])).toBe("a,b\r\nx,2\r\n");
});

test("quotes commas, quotes and line breaks", () => {
	expect(toCsv([{ v: 'Rent, "June"' }, { v: "two\nlines" }], ["v"])).toBe('v\r\n"Rent, ""June"""\r\n"two\nlines"\r\n');
});

test("keeps text that looks like a formula as text, but not negative numbers", () => {
	expect(toCsv([{ v: "=HYPERLINK(1)" }, { v: "-5" }, { v: -5 }, { v: "@me" }], ["v"])).toBe(
		"v\r\n'=HYPERLINK(1)\r\n'-5\r\n-5\r\n'@me\r\n"
	);
});

test("leaves empty values blank", () => {
	expect(toCsv([{ a: null, b: undefined, c: false }], ["a", "b", "c"])).toBe("a,b,c\r\n,,false\r\n");
});

test("account activity names deleted accounts", () => {
	const csv = buildExportCsv("account_transactions", [
		{
			transaction_date: "2026-10-01",
			transaction_type: "deposit",
			amount: "120.50",
			description: "Pay",
			account: { name: "Chequing" },
		},
		{
			transaction_date: "2026-09-30",
			transaction_type: "withdrawal",
			amount: "-20",
			description: "Cash",
			account: null,
		},
	]);
	expect(csv).toBe(
		"Date,Account,Type,Amount,Description\r\n2026-10-01,Chequing,deposit,120.5,Pay\r\n2026-09-30,Deleted account,withdrawal,-20,Cash\r\n"
	);
});

test("accounts show the rate as a percentage", () => {
	const csv = buildExportCsv("accounts", [
		{
			name: "Savings",
			institution: "EQ",
			current_balance: 5000,
			credit_limit: null,
			interest_rate: "0.0275",
			payment_due_date: null,
			is_active: true,
			created_at: "2026-01-05T10:00:00Z",
			account_type: { name: "Savings", class: "asset" },
		},
	]);
	expect(csv.split("\r\n")[1]).toBe("Savings,EQ,Savings,asset,5000,,2.75,,Yes,2026-01-05");
});

test("everything goes in one file, each table under its title with a blank line between", () => {
	const csv = buildFullExportCsv({
		accounts: [],
		account_transactions: [],
		budget_transactions: [{ transaction_date: "2026-10-02", name: "Store", amount: -40, notes: null, category: null }],
		recurring: [],
	});
	expect(csv.split("\r\n")).toEqual([
		"Accounts",
		"Name,Institution,Type,Class,Balance,Credit limit,Interest rate (%),Payment due day,Active,Created",
		"",
		"Account activity",
		"Date,Account,Type,Amount,Description",
		"",
		"Budget transactions",
		"Date,Name,Category,Amount,Notes",
		"2026-10-02,Store,Uncategorized,-40,",
		"",
		"Recurring",
		"Name,Kind,Amount,Repeats every,Next due,Active",
		"",
	]);
});

test("the file is named by date", () => {
	expect(exportFilename("2026-10-24")).toBe("pholio-export-2026-10-24.csv");
});
