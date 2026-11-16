import { describe, expect, test } from "bun:test";
import { exportFilename, monthsInRange, rangeDates, toExportRows } from "@/app/allocations/export-rows";

describe("rangeDates", () => {
	test("one month runs from the 1st to its last day", () => {
		expect(rangeDates({ startYear: 2026, startMonth: 2, endYear: 2026, endMonth: 2 })).toEqual({
			startDate: "2026-02-01",
			endDate: "2026-02-28",
		});
	});

	test("a leap February ends on the 29th", () => {
		expect(rangeDates({ startYear: 2028, startMonth: 2, endYear: 2028, endMonth: 2 }).endDate).toBe("2028-02-29");
	});

	test("a range across the new year", () => {
		expect(rangeDates({ startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 1 })).toEqual({
			startDate: "2025-11-01",
			endDate: "2026-01-31",
		});
	});
});

describe("monthsInRange", () => {
	test("counts both ends", () => {
		expect(monthsInRange({ startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 1 })).toBe(3);
		expect(monthsInRange({ startYear: 2026, startMonth: 5, endYear: 2026, endMonth: 5 })).toBe(1);
	});

	test("is zero or less when the end is before the start", () => {
		expect(monthsInRange({ startYear: 2026, startMonth: 5, endYear: 2026, endMonth: 4 })).toBe(0);
	});
});

describe("toExportRows", () => {
	test("keeps the stored date, labels type by sign or transfer, and marks recurring payments", () => {
		const rows = toExportRows([
			{ transaction_date: "2026-03-01", name: "Rent", amount: -1500, source: "recurring", recurring_expense_id: "r1", category_name: "Housing" },
			{ transaction_date: "2026-03-15", name: "Pay", amount: 2400, source: "manual", category_name: null },
			{ transaction_date: "2026-03-10", name: "To TFSA", amount: -200, source: "transfer", category_name: null },
		]);

		expect(rows).toEqual([
			["2026-03-15", "Pay", "Uncategorized", 2400, "income", "No"],
			["2026-03-10", "To TFSA", "Uncategorized", -200, "transfer", "No"],
			["2026-03-01", "Rent", "Housing", -1500, "expense", "Yes"],
		]);
	});

	test("turns decimal strings from Postgres into numbers", () => {
		const [row] = toExportRows([
			{ transaction_date: "2026-03-02", name: "Lunch", amount: "-14.50" as unknown as number, source: "manual" },
		]);
		expect(row[3]).toBe(-14.5);
	});
});

describe("exportFilename", () => {
	test("names one month or a range", () => {
		expect(exportFilename({ startYear: 2026, startMonth: 3, endYear: 2026, endMonth: 3 })).toBe("pholio_export_03_2026.xlsx");
		expect(exportFilename({ startYear: 2025, startMonth: 11, endYear: 2026, endMonth: 1 })).toBe(
			"pholio_export_11_2025_to_01_2026.xlsx"
		);
	});
});
