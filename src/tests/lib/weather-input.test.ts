import { describe, expect, test } from "bun:test";
import type { AccountTypeCode, AccountWithType } from "@/app/accounts/types";
import type { BillInput } from "@/app/dashboard/heads-up";
import { computeWeather, WEATHERS } from "@/lib/financial-weather";
import { accountsForWeather, billsForWeather } from "@/lib/weather-input";
import { getSampleWeatherInput } from "@/mock-data/dashboard";

function account(code: AccountTypeCode | null, balance: number, creditLimit: number | null = null): AccountWithType {
	return {
		current_balance: balance,
		credit_limit: creditLimit,
		account_type: { code },
	} as unknown as AccountWithType;
}

describe("accountsForWeather", () => {
	test("cash is chequing plus savings, chosen by code", () => {
		const result = accountsForWeather([
			account("chequing", 1200.5),
			account("savings", 3000),
			account("investment", 50000),
			account(null, 999),
		]);
		expect(result.liquidCash).toBe(4200.5);
	});

	test("cards are credit cards and lines of credit with a limit", () => {
		const result = accountsForWeather([
			account("credit_card", 450, 2000),
			account("line_of_credit", 1000, 5000),
			account("credit_card", 300, null),
			account("mortgage", 300000, null),
		]);
		expect(result.cards).toEqual([
			{ balance: 450, limit: 2000 },
			{ balance: 1000, limit: 5000 },
		]);
	});

	test("no chequing or savings means no cash figure", () => {
		expect(accountsForWeather([account("investment", 50000)]).liquidCash).toBeNull();
	});
});

describe("billsForWeather", () => {
	const today = "2026-10-23";
	const bills: BillInput[] = [
		{ id: "rent", name: "Rent", amount: 1800, dueDate: "2026-11-01", status: "upcoming" },
		{ id: "net", name: "Internet", amount: 80, dueDate: "2026-10-15", status: "overdue" },
		{ id: "phone", name: "Phone", amount: 60, dueDate: "2026-10-20", status: "paid" },
		{ id: "old", name: "Old app", amount: 5, dueDate: "2026-10-01", status: "overdue", isActive: false },
	];

	test("counts overdue bills and keeps every open one", () => {
		expect(billsForWeather(bills, today)).toEqual({
			hasBills: true,
			overdueBills: 1,
			openBills: [
				{ dueDate: "2026-10-15", amount: 80 },
				{ dueDate: "2026-11-01", amount: 1800 },
			],
		});
	});

	test("no active bills means none tracked", () => {
		expect(billsForWeather([bills[3]], today).hasBills).toBe(false);
	});
});

describe("sample weather", () => {
	test("grades the sample data on any day", () => {
		for (const day of [new Date(2026, 0, 3), new Date(2026, 5, 18), new Date(2026, 9, 31)]) {
			const report = computeWeather(getSampleWeatherInput(day));
			expect(report.enoughData).toBe(true);
			expect(WEATHERS).toContain(report.weather);
		}
	});
});
