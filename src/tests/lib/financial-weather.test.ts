import { describe, expect, test } from "bun:test";
import type { MonthPace } from "@/app/dashboard/month-pace";
import {
	computeWeather,
	pickWeather,
	scoreOnCurve,
	toWeatherTransactions,
	type HealthSignalKey,
	type TurbulenceSignalKey,
	type WeatherInput,
	type WeatherReport,
	type WeatherTransaction,
} from "@/lib/financial-weather";

// A Friday; the complete months are July, August and September.
const today = "2026-10-23";

/** Ten equal purchases on days 1, 4, 7 … 28 of the month. */
function spend(month: string, total: number): WeatherTransaction[] {
	return Array.from({ length: 10 }, (_, i) => ({
		date: `${month}-${String(1 + i * 3).padStart(2, "0")}`,
		amount: -total / 10,
	}));
}

function earn(date: string, amount: number): WeatherTransaction {
	return { date, amount };
}

/** Income and spending for July, August and September. */
function quarter(income: [number, number, number], spending: [number, number, number]): WeatherTransaction[] {
	return [
		earn("2026-07-15", income[0]),
		earn("2026-08-15", income[1]),
		earn("2026-09-15", income[2]),
		...spend("2026-07", spending[0]),
		...spend("2026-08", spending[1]),
		...spend("2026-09", spending[2]),
	];
}

function pace(overrides: Partial<MonthPace> = {}): MonthPace {
	return {
		year: 2026,
		month: 10,
		budget: 1000,
		spent: 0,
		expectedByToday: 0,
		difference: 0,
		dayOfMonth: 23,
		daysInMonth: 31,
		daysLeft: 8,
		remaining: 1000,
		dailyAllowance: 0,
		status: "on_pace",
		usesTypicalCurve: false,
		cumulative: [],
		expected: [],
		...overrides,
	};
}

function input(overrides: Partial<WeatherInput> = {}): WeatherInput {
	return {
		today,
		transactions: [],
		monthPace: null,
		netWorth: [],
		hasBills: false,
		overdueBills: 0,
		openBills: [],
		cards: [],
		liquidCash: null,
		...overrides,
	};
}

function health(report: WeatherReport, key: HealthSignalKey): number | undefined {
	return report.healthSignals.find((signal) => signal.key === key)?.score;
}

function turbulence(report: WeatherReport, key: TurbulenceSignalKey): number | undefined {
	return report.turbulenceSignals.find((signal) => signal.key === key)?.score;
}

describe("scoreOnCurve", () => {
	const curve: [number, number][] = [
		[0, 0],
		[10, 100],
	];

	test("draws a straight line between points", () => {
		expect(scoreOnCurve(5, curve)).toBe(50);
	});

	test("stays flat beyond the ends", () => {
		expect(scoreOnCurve(-3, curve)).toBe(0);
		expect(scoreOnCurve(20, curve)).toBe(100);
	});
});

describe("toWeatherTransactions", () => {
	test("leaves transfers between the user's own accounts out", () => {
		expect(
			toWeatherTransactions([
				{ transaction_date: "2026-10-01", amount: "-50.25", source: "manual" },
				{ transaction_date: "2026-10-02T00:00:00", amount: -500, source: "transfer" },
				{ transaction_date: "2026-10-03", amount: 900, source: "external" },
			])
		).toEqual([
			{ date: "2026-10-01", amount: -50.25 },
			{ date: "2026-10-03", amount: 900 },
		]);
	});
});

describe("spending pace", () => {
	const scoreFor = (overrides: Partial<MonthPace>) =>
		health(computeWeather(input({ monthPace: pace(overrides) })), "pace");

	test("scores where spending sits against the budget", () => {
		expect(scoreFor({ difference: -100 })).toBe(100);
		expect(scoreFor({ difference: 0 })).toBe(70);
		expect(scoreFor({ difference: 50 })).toBe(50);
		expect(scoreFor({ difference: 150 })).toBe(15);
	});

	test("caps an over-budget month at 10", () => {
		expect(scoreFor({ difference: 20, status: "over_budget" })).toBe(10);
	});

	test("leans toward neutral in the first five days", () => {
		// 60 + (70 − 60) × 3/6
		expect(scoreFor({ difference: 0, dayOfMonth: 3 })).toBe(65);
	});

	test("is left out without a budget", () => {
		expect(scoreFor({ budget: 0 })).toBeUndefined();
	});
});

describe("cash flow", () => {
	const scoreFor = (income: [number, number, number], spending: [number, number, number]) =>
		health(computeWeather(input({ transactions: quarter(income, spending) })), "cashflow");

	test("scores the savings rate", () => {
		expect(scoreFor([5000, 5000, 5000], [4000, 4000, 4000])).toBe(100);
		expect(scoreFor([5000, 5000, 5000], [5000, 5000, 5000])).toBe(55);
		expect(scoreFor([5000, 5000, 5000], [5500, 5500, 5500])).toBe(30);
	});

	test("weights the newest month most", () => {
		// September saves 10%, July and August break even: 0.5 × 10% = 5% → halfway from 55 to 85.
		expect(scoreFor([5000, 5000, 5000], [5000, 5000, 4500])).toBe(70);
	});

	test("is left out when no income is recorded", () => {
		expect(scoreFor([0, 0, 0], [4000, 4000, 4000])).toBeUndefined();
	});
});

describe("net worth trend", () => {
	const scoreFor = (from: number, start = "2026-07-15") =>
		health(
			computeWeather(
				input({
					transactions: quarter([5000, 5000, 5000], [4000, 4000, 4000]),
					netWorth: [
						{ date: start, value: from, assets: from, liabilities: 0 },
						{ date: today, value: 10000, assets: 10000, liabilities: 0 },
					],
				})
			),
			"trend"
		);

	test("measures the change in months of spending", () => {
		expect(scoreFor(6000)).toBe(100);
		expect(scoreFor(10000)).toBe(55);
		expect(scoreFor(11000)).toBe(35);
	});

	test("is left out with under 30 days of history", () => {
		expect(scoreFor(6000, "2026-10-10")).toBeUndefined();
	});
});

describe("bills and debt", () => {
	const scoreFor = (overrides: Partial<WeatherInput>) => health(computeWeather(input(overrides)), "obligations");

	test("loses 35 per overdue bill", () => {
		expect(scoreFor({ hasBills: true })).toBe(100);
		expect(scoreFor({ hasBills: true, overdueBills: 2 })).toBe(30);
		expect(scoreFor({ hasBills: true, overdueBills: 3 })).toBe(0);
	});

	test("mixes in card utilization", () => {
		// 0.6 × 100 + 0.4 × 60
		expect(scoreFor({ hasBills: true, cards: [{ balance: 500, limit: 1000 }] })).toBe(84);
		expect(scoreFor({ cards: [{ balance: 900, limit: 1000 }] })).toBe(0);
	});

	test("is left out with no bills and no cards", () => {
		expect(scoreFor({})).toBeUndefined();
	});
});

describe("runway to payday", () => {
	// $3,040 a month is $100 a day. Irregular income, so payday falls back to 1 November: 9 days away.
	const transactions = [
		...spend("2026-07", 3040),
		...spend("2026-08", 3040),
		...spend("2026-09", 3040),
		earn("2026-07-03", 1000),
		earn("2026-08-20", 1000),
		earn("2026-09-09", 1000),
	];
	const openBills = [
		{ dueDate: "2026-10-30", amount: 100 },
		{ dueDate: "2026-11-05", amount: 999 },
	];
	const scoreFor = (liquidCash: number | null, day = today) =>
		health(computeWeather(input({ today: day, transactions, openBills, liquidCash })), "runway");

	test("compares cash with bills and spending until payday", () => {
		// Needs: the $100 bill before payday plus 9 × $100.
		expect(scoreFor(2000)).toBe(100);
		expect(scoreFor(1250)).toBe(75);
		expect(scoreFor(1000)).toBe(50);
		expect(scoreFor(750)).toBe(25);
		expect(scoreFor(400)).toBe(0);
	});

	test("a low balance just before payday is not a crisis", () => {
		// On 30 October only 2 days remain: $100 bill + 2 × $100 = $300 needed.
		expect(scoreFor(600, "2026-10-30")).toBe(100);
		expect(scoreFor(600)).toBe(10);
	});

	test("is left out without chequing or savings", () => {
		expect(scoreFor(null)).toBeUndefined();
	});
});

describe("turbulence", () => {
	const steady = quarter([5000, 5000, 5000], [3040, 3040, 3040]);

	test("big spending days count; income days never do", () => {
		// Threshold: 25% of $3,040 = $760.
		const fourBig = [-1000, -1000, -1000, -1000].map((amount, i) => earn(`2026-10-0${2 + i * 2}`, amount));
		expect(turbulence(computeWeather(input({ transactions: [...steady, ...fourBig] })), "spending_days")).toBe(100);
		expect(
			turbulence(computeWeather(input({ transactions: [...steady, ...fourBig.slice(0, 2)] })), "spending_days")
		).toBe(50);
		const windfall = earn("2026-10-20", 9000);
		expect(turbulence(computeWeather(input({ transactions: [...steady, windfall] })), "spending_days")).toBe(0);
	});

	test("a burst of activity against the usual two weeks", () => {
		// 45 purchases 14 to 103 days ago is 7 per fortnight.
		const usual = Array.from({ length: 45 }, (_, i) => earn(dateDaysAgo(14 + i * 2), -10));
		const recent = (count: number) => Array.from({ length: count }, (_, i) => earn(dateDaysAgo(i % 14), -10));
		expect(turbulence(computeWeather(input({ transactions: [...usual, ...recent(7)] })), "activity")).toBe(0);
		// 14 ÷ 7 = 2× → 50 + (0.4 / 0.6) × 50
		expect(turbulence(computeWeather(input({ transactions: [...usual, ...recent(14)] })), "activity")).toBe(83.3);
	});

	test("spending that keeps crossing the expected pace", () => {
		const expected = Array.from({ length: 10 }, (_, i) => (i + 1) * 100);
		const cumulative = [200, 100, 400, 300, 500, 600, 700, 800, 900, 1000];
		const monthPace = pace({ dayOfMonth: 10, expected, cumulative });
		expect(turbulence(computeWeather(input({ monthPace })), "pace_swings")).toBe(100);
	});

	test("an income dip counts; a windfall does not", () => {
		const dip = quarter([2000, 5000, 5000], [3040, 3040, 3040]);
		expect(turbulence(computeWeather(input({ transactions: dip })), "income_dips")).toBe(100);
		const windfall = quarter([5000, 5000, 9000], [3040, 3040, 3040]);
		expect(turbulence(computeWeather(input({ transactions: windfall })), "income_dips")).toBe(0);
	});
});

describe("pickWeather", () => {
	test("health sets the sky", () => {
		expect(pickWeather(70, 10)).toBe("sunny");
		expect(pickWeather(69.9, 10)).toBe("cloudy");
		expect(pickWeather(45, null)).toBe("cloudy");
		expect(pickWeather(44.9, null)).toBe("rainy");
	});

	test("high turbulence is windy unless the direction is clear", () => {
		expect(pickWeather(50, 60)).toBe("windy");
		expect(pickWeather(90, 80)).toBe("sunny");
		expect(pickWeather(20, 80)).toBe("rainy");
		expect(pickWeather(50, 59.9)).toBe("cloudy");
	});
});

describe("computeWeather", () => {
	test("stays cloudy until there is enough history", () => {
		const report = computeWeather(
			input({ transactions: [earn("2026-10-15", -40), earn("2026-10-20", 1000)], liquidCash: 5000, hasBills: true })
		);
		expect(report).toMatchObject({ weather: "cloudy", enoughData: false, health: null });
	});

	test("a good quarter is sunny", () => {
		const report = computeWeather(
			input({
				transactions: quarter([5000, 5000, 5000], [3500, 3500, 3500]),
				monthPace: pace({ difference: -100 }),
				netWorth: [
					{ date: "2026-07-15", value: 6000, assets: 6000, liabilities: 0 },
					{ date: today, value: 10000, assets: 10000, liabilities: 0 },
				],
				hasBills: true,
				liquidCash: 8000,
			})
		);
		expect(report.weather).toBe("sunny");
	});

	test("an overdue bill keeps an otherwise good quarter from being sunny", () => {
		const report = computeWeather(
			input({
				transactions: quarter([5000, 5000, 5000], [3500, 3500, 3500]),
				monthPace: pace({ difference: -100 }),
				netWorth: [
					{ date: "2026-07-15", value: 6000, assets: 6000, liabilities: 0 },
					{ date: today, value: 10000, assets: 10000, liabilities: 0 },
				],
				hasBills: true,
				overdueBills: 1,
				liquidCash: 8000,
			})
		);
		expect(report).toMatchObject({ weather: "cloudy", health: 69 });
	});

	test("a bad quarter is rainy", () => {
		const report = computeWeather(
			input({
				transactions: quarter([5000, 5000, 5000], [6000, 6000, 6000]),
				monthPace: pace({ difference: 30, status: "over_budget" }),
				netWorth: [
					{ date: "2026-07-15", value: 16000, assets: 16000, liabilities: 0 },
					{ date: today, value: 10000, assets: 10000, liabilities: 0 },
				],
				hasBills: true,
				overdueBills: 2,
				liquidCash: 200,
			})
		);
		expect(report.weather).toBe("rainy");
	});
});

function dateDaysAgo(days: number): string {
	const date = new Date(2026, 9, 23 - days);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
