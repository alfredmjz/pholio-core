import { toCsv, type CsvValue } from "@/lib/csv";

/** Typed by the user, and checked again on the server, before an account is deleted. */
export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";
export const RESET_DATA_CONFIRMATION = "RESET";

export const EXPORT_KINDS = ["accounts", "account_transactions", "budget_transactions", "recurring"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/** The tables in the export file, in the order they appear. */
const EXPORT_TITLES: Record<ExportKind, string> = {
	accounts: "Accounts",
	account_transactions: "Account activity",
	budget_transactions: "Budget transactions",
	recurring: "Recurring",
};

type Row = Record<string, unknown>;

const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value));
const amount = (value: unknown): CsvValue => (value === null || value === undefined ? "" : Number(value));
const joined = (value: unknown): Row | null => (Array.isArray(value) ? (value[0] ?? null) : (value as Row | null));

const BUILDERS: Record<ExportKind, (rows: Row[]) => string> = {
	accounts: (rows) =>
		toCsv(
			rows.map((row) => {
				const type = joined(row.account_type);
				return {
					Name: text(row.name),
					Institution: text(row.institution),
					Type: text(type?.name),
					Class: text(type?.class),
					Balance: amount(row.current_balance),
					"Credit limit": amount(row.credit_limit),
					"Interest rate (%)":
						row.interest_rate === null || row.interest_rate === undefined ? "" : Number(row.interest_rate) * 100,
					"Payment due day": amount(row.payment_due_date),
					Active: row.is_active === false ? "No" : "Yes",
					Created: text(row.created_at).slice(0, 10),
				};
			}),
			[
				"Name",
				"Institution",
				"Type",
				"Class",
				"Balance",
				"Credit limit",
				"Interest rate (%)",
				"Payment due day",
				"Active",
				"Created",
			]
		),
	account_transactions: (rows) =>
		toCsv(
			rows.map((row) => {
				const account = joined(row.account);
				return {
					Date: text(row.transaction_date),
					Account: account ? text(account.name) : "Deleted account",
					Type: text(row.transaction_type),
					Amount: amount(row.amount),
					Description: text(row.description),
				};
			}),
			["Date", "Account", "Type", "Amount", "Description"]
		),
	budget_transactions: (rows) =>
		toCsv(
			rows.map((row) => ({
				Date: text(row.transaction_date),
				Name: text(row.name),
				Category: text(joined(row.category)?.name) || "Uncategorized",
				Amount: amount(row.amount),
				Notes: text(row.notes),
			})),
			["Date", "Name", "Category", "Amount", "Notes"]
		),
	recurring: (rows) =>
		toCsv(
			rows.map((row) => ({
				Name: text(row.name),
				Kind: row.category === "subscription" ? "Subscription" : "Bill",
				Amount: amount(row.amount),
				"Repeats every": text(row.billing_period),
				"Next due": text(row.next_due_date),
				Active: row.is_active === false ? "No" : "Yes",
			})),
			["Name", "Kind", "Amount", "Repeats every", "Next due", "Active"]
		),
};

export function buildExportCsv(kind: ExportKind, rows: Row[]): string {
	return BUILDERS[kind](rows);
}

/** Everything in one CSV: each table under a title row, with a blank line between tables. */
export function buildFullExportCsv(tables: Record<ExportKind, Row[]>): string {
	return EXPORT_KINDS.map((kind) => `${EXPORT_TITLES[kind]}\r\n${buildExportCsv(kind, tables[kind])}`).join("\r\n");
}

/** What each export reads, newest first where it has a date. */
export const EXPORT_QUERIES: Record<ExportKind, { table: string; select: string; order: string }> = {
	accounts: {
		table: "accounts",
		select:
			"name, institution, current_balance, credit_limit, interest_rate, payment_due_date, is_active, created_at, account_type:account_types(name, class)",
		order: "created_at",
	},
	account_transactions: {
		table: "account_transactions",
		select: "transaction_date, transaction_type, amount, description, account:accounts(name)",
		order: "transaction_date",
	},
	budget_transactions: {
		table: "transactions",
		select: "transaction_date, name, amount, notes, category:allocation_categories(name)",
		order: "transaction_date",
	},
	recurring: {
		table: "recurring_expenses",
		select: "name, category, amount, billing_period, next_due_date, is_active",
		order: "next_due_date",
	},
};

export function exportFilename(today: string): string {
	return `pholio-export-${today}.csv`;
}
