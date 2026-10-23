/**
 * The weather behind every signed-in page, graded from the user's own finances.
 *
 * Health (0-100) says how well things are going; turbulence (0-100) says how unsettled they are,
 * whichever way. Every signal is scaled to the user's own income, spending and budget, a signal
 * without data is dropped and its weight spread over the rest, and transfers between the user's
 * own accounts never reach this module. See docs/136-financial-weather-spec.md.
 */

import { buildMonthlyCashflow, isTransfer } from "@/app/dashboard/cashflow";
import type { MonthPace } from "@/app/dashboard/month-pace";
import type { NetWorthPoint } from "@/app/dashboard/net-worth-series";
import { dayIndex, inferPaySchedule } from "@/lib/paycheck";

export type Weather = "sunny" | "cloudy" | "rainy" | "windy";

export const WEATHERS: Weather[] = ["cloudy", "rainy", "sunny", "windy"];

export type HealthSignalKey = "pace" | "cashflow" | "trend" | "obligations" | "runway";
export type TurbulenceSignalKey = "spending_days" | "activity" | "pace_swings" | "income_dips";

export interface WeatherSignal<Key extends string> {
	key: Key;
	weight: number;
	/** 0-100 */
	score: number;
}

export interface WeatherTransaction {
	/** YYYY-MM-DD */
	date: string;
	/** Positive for income, negative for spending. Transfers are left out before this point. */
	amount: number;
}

export interface WeatherBill {
	/** YYYY-MM-DD */
	dueDate: string;
	amount: number;
}

export interface WeatherCard {
	/** Amount owed, as a positive number. */
	balance: number;
	limit: number;
}

export interface WeatherInput {
	/** YYYY-MM-DD */
	today: string;
	/** At least the last six months of income and spending. */
	transactions: WeatherTransaction[];
	monthPace: MonthPace | null;
	/** Net worth over time, ending today. */
	netWorth: NetWorthPoint[];
	/** Whether the user tracks any active recurring bills. */
	hasBills: boolean;
	overdueBills: number;
	/** Unpaid bills, overdue ones included. */
	openBills: WeatherBill[];
	/** Credit cards and lines of credit that have a limit. */
	cards: WeatherCard[];
	/** Chequing plus savings, or null when the user has neither. */
	liquidCash: number | null;
}

export interface WeatherReport {
	weather: Weather;
	/** Null when there is not enough data yet. */
	health: number | null;
	/** Null when too few turbulence signals have data. */
	turbulence: number | null;
	enoughData: boolean;
	healthSignals: WeatherSignal<HealthSignalKey>[];
	turbulenceSignals: WeatherSignal<TurbulenceSignalKey>[];
}

export const SUNNY_FROM = 70;
export const CLOUDY_FROM = 45;
export const WINDY_FROM = 60;
/** Windy only while health is between these; a clear direction wins over turbulence. */
export const WINDY_HEALTH_RANGE: [number, number] = [25, 85];
export const MIN_HISTORY_DAYS = 30;
/** The share of the health weight that must have data before the weather is graded. */
export const MIN_HEALTH_WEIGHT = 40;
/** The most health can reach while any bill is overdue: never sunny with bills unpaid. */
export const OVERDUE_HEALTH_CAP = 69;

const HEALTH_WEIGHTS: Record<HealthSignalKey, number> = {
	pace: 25,
	cashflow: 25,
	trend: 20,
	obligations: 15,
	runway: 15,
};
const TURBULENCE_WEIGHTS: Record<TurbulenceSignalKey, number> = {
	spending_days: 35,
	activity: 25,
	pace_swings: 20,
	income_dips: 20,
};

export interface LedgerRow {
	transaction_date: string;
	amount: number | string;
	source?: string | null;
}

export function toWeatherTransactions(rows: LedgerRow[]): WeatherTransaction[] {
	return rows
		.filter((row) => !isTransfer(row))
		.map((row) => ({ date: String(row.transaction_date).slice(0, 10), amount: Number(row.amount) }));
}

type Curve = [number, number][];

/** Straight lines between the points, flat beyond the first and last. */
export function scoreOnCurve(value: number, curve: Curve): number {
	if (value <= curve[0][0]) return curve[0][1];
	for (let i = 1; i < curve.length; i++) {
		const [x1, y1] = curve[i];
		if (value <= x1) {
			const [x0, y0] = curve[i - 1];
			return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
		}
	}
	return curve[curve.length - 1][1];
}

function round(value: number): number {
	return Math.round(value * 10) / 10;
}

function weightedScore<Key extends string>(signals: WeatherSignal<Key>[]): number | null {
	const weight = signals.reduce((sum, signal) => sum + signal.weight, 0);
	if (weight === 0) return null;
	return round(signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / weight);
}

interface MonthTotals {
	income: number;
	spending: number;
}

/** The last three complete months, newest first. */
function completeMonths(transactions: WeatherTransaction[], today: string): MonthTotals[] {
	return buildMonthlyCashflow(transactions, today, 4)
		.slice(0, 3)
		.reverse()
		.map((month) => ({ income: month.income, spending: month.expenses }));
}

function averageSpending(months: MonthTotals[]): number {
	const active = months.filter((month) => month.spending > 0);
	if (active.length === 0) return 0;
	return active.reduce((sum, month) => sum + month.spending, 0) / active.length;
}

function paceSignal(pace: MonthPace | null): number | null {
	if (!pace || pace.budget <= 0 || pace.dayOfMonth === 0) return null;
	const share = pace.difference / pace.budget;
	let score = scoreOnCurve(share, [
		[-0.1, 100],
		[0, 70],
		[0.05, 50],
		[0.15, 15],
	]);
	if (pace.status === "over_budget") score = Math.min(score, 10);
	// Too early in the month to tell: lean toward neutral for the first five days.
	if (pace.dayOfMonth <= 5) score = 60 + (score - 60) * (pace.dayOfMonth / 6);
	return score;
}

const MONTH_WEIGHTS = [0.5, 0.3, 0.2];

function cashflowSignal(months: MonthTotals[]): number | null {
	if (months.every((month) => month.income === 0)) return null;
	let rate = 0;
	let weight = 0;
	months.forEach((month, i) => {
		if (month.income === 0 && month.spending === 0) return;
		const monthRate = month.income > 0 ? (month.income - month.spending) / month.income : -1;
		rate += monthRate * MONTH_WEIGHTS[i];
		weight += MONTH_WEIGHTS[i];
	});
	if (weight === 0) return null;
	return scoreOnCurve(rate / weight, [
		[-0.25, 0],
		[-0.1, 30],
		[0, 55],
		[0.1, 85],
		[0.2, 100],
	]);
}

function trendSignal(netWorth: NetWorthPoint[], today: string, monthlySpending: number): number | null {
	if (monthlySpending <= 0 || netWorth.length < 2) return null;
	const todayIndex = dayIndex(today);
	const first = netWorth[0];
	if (todayIndex - dayIndex(first.date) < MIN_HISTORY_DAYS) return null;
	const before = netWorth.filter((point) => todayIndex - dayIndex(point.date) >= 90);
	const start = before.length > 0 ? before[before.length - 1] : first;
	const change = netWorth[netWorth.length - 1].value - start.value;
	return scoreOnCurve(change / monthlySpending, [
		[-1, 0],
		[-0.25, 35],
		[0, 55],
		[0.25, 75],
		[1, 100],
	]);
}

function obligationsSignal(input: WeatherInput): number | null {
	if (!input.hasBills && input.cards.length === 0) return null;
	const bills = Math.max(0, 100 - 35 * input.overdueBills);
	const limit = input.cards.reduce((sum, card) => sum + card.limit, 0);
	if (limit <= 0) return bills;
	const used = input.cards.reduce((sum, card) => sum + Math.max(0, card.balance), 0) / limit;
	const utilization = scoreOnCurve(used, [
		[0.3, 100],
		[0.5, 60],
		[0.9, 0],
	]);
	return input.hasBills ? 0.6 * bills + 0.4 * utilization : utilization;
}

function runwaySignal(input: WeatherInput, monthlySpending: number): number | null {
	if (input.liquidCash === null) return null;
	const { nextPayday } = inferPaySchedule(
		input.transactions.filter((t) => t.amount > 0).map((t) => ({ date: t.date, amount: t.amount })),
		input.today
	);
	const paydayIndex = dayIndex(nextPayday);
	const days = Math.max(1, paydayIndex - dayIndex(input.today));
	const billsBeforePayday = input.openBills
		.filter((bill) => dayIndex(bill.dueDate) <= paydayIndex)
		.reduce((sum, bill) => sum + bill.amount, 0);
	const needs = billsBeforePayday + (monthlySpending / 30.4) * days;
	if (needs <= 0) return 100;
	return scoreOnCurve(input.liquidCash / needs, [
		[0.5, 0],
		[0.75, 25],
		[1, 50],
		[1.25, 75],
		[2, 100],
	]);
}

function spendingDaysSignal(transactions: WeatherTransaction[], today: string, monthlySpending: number): number | null {
	if (monthlySpending <= 0) return null;
	const todayIndex = dayIndex(today);
	const net = new Map<number, number>();
	for (const t of transactions) {
		const index = dayIndex(t.date);
		if (index > todayIndex || index <= todayIndex - 30) continue;
		net.set(index, (net.get(index) ?? 0) + t.amount);
	}
	// Only money going out makes a day unsettled; an income day never does.
	const big = Array.from(net.values()).filter((amount) => -amount > monthlySpending * 0.25).length;
	return scoreOnCurve(big, [
		[0, 0],
		[2, 50],
		[4, 100],
	]);
}

function activitySignal(transactions: WeatherTransaction[], today: string): number | null {
	const todayIndex = dayIndex(today);
	let recent = 0;
	let earlier = 0;
	for (const t of transactions) {
		const age = todayIndex - dayIndex(t.date);
		if (age >= 0 && age < 14) recent++;
		else if (age >= 14 && age < 104) earlier++;
	}
	const usual = earlier / (90 / 14);
	if (usual < 3) return null;
	return scoreOnCurve(recent / usual, [
		[1.2, 0],
		[1.6, 50],
		[2.2, 100],
	]);
}

function paceSwingsSignal(pace: MonthPace | null): number | null {
	if (!pace || pace.budget <= 0 || pace.dayOfMonth < 7) return null;
	const band = pace.budget * 0.05;
	let side = 0;
	let swings = 0;
	pace.cumulative.forEach((spent, i) => {
		const gap = spent - pace.expected[i];
		const now = gap > band ? 1 : gap < -band ? -1 : 0;
		if (now !== 0 && side !== 0 && now !== side) swings++;
		if (now !== 0) side = now;
	});
	return scoreOnCurve(swings, [
		[1, 0],
		[2, 50],
		[3, 100],
	]);
}

function incomeDipsSignal(months: MonthTotals[]): number | null {
	const incomes = months.map((month) => month.income).sort((a, b) => a - b);
	if (incomes.filter((income) => income > 0).length < 2) return null;
	// Measured against the middle month, so a windfall never makes ordinary months look like dips.
	const usual = incomes[Math.floor(incomes.length / 2)];
	const dip = (usual - incomes[0]) / usual;
	return scoreOnCurve(dip, [
		[0.1, 0],
		[0.25, 50],
		[0.45, 100],
	]);
}

function collect<Key extends string>(weights: Record<Key, number>, scores: Record<Key, number | null>) {
	return (Object.keys(weights) as Key[])
		.filter((key) => scores[key] !== null)
		.map((key) => ({ key, weight: weights[key], score: round(scores[key] as number) }));
}

function hasEnoughHistory(input: WeatherInput): boolean {
	const todayIndex = dayIndex(input.today);
	const oldestTransaction = input.transactions.reduce(
		(oldest, t) => Math.min(oldest, dayIndex(t.date)),
		Number.POSITIVE_INFINITY
	);
	const oldestNetWorth = input.netWorth.length > 1 ? dayIndex(input.netWorth[0].date) : Number.POSITIVE_INFINITY;
	return todayIndex - Math.min(oldestTransaction, oldestNetWorth) >= MIN_HISTORY_DAYS;
}

export function pickWeather(health: number, turbulence: number | null): Weather {
	if (
		turbulence !== null &&
		turbulence >= WINDY_FROM &&
		health >= WINDY_HEALTH_RANGE[0] &&
		health <= WINDY_HEALTH_RANGE[1]
	) {
		return "windy";
	}
	if (health >= SUNNY_FROM) return "sunny";
	if (health >= CLOUDY_FROM) return "cloudy";
	return "rainy";
}

export function computeWeather(input: WeatherInput): WeatherReport {
	const months = completeMonths(input.transactions, input.today);
	const monthlySpending = averageSpending(months);

	const healthSignals = collect(HEALTH_WEIGHTS, {
		pace: paceSignal(input.monthPace),
		cashflow: cashflowSignal(months),
		trend: trendSignal(input.netWorth, input.today, monthlySpending),
		obligations: obligationsSignal(input),
		runway: runwaySignal(input, monthlySpending),
	});
	const turbulenceSignals = collect(TURBULENCE_WEIGHTS, {
		spending_days: spendingDaysSignal(input.transactions, input.today, monthlySpending),
		activity: activitySignal(input.transactions, input.today),
		pace_swings: paceSwingsSignal(input.monthPace),
		income_dips: incomeDipsSignal(months),
	});

	const healthWeight = healthSignals.reduce((sum, signal) => sum + signal.weight, 0);
	const enoughData = hasEnoughHistory(input) && healthSignals.length >= 2 && healthWeight >= MIN_HEALTH_WEIGHT;
	const turbulenceWeight = turbulenceSignals.reduce((sum, signal) => sum + signal.weight, 0);
	const turbulence = turbulenceWeight >= 40 ? weightedScore(turbulenceSignals) : null;

	if (!enoughData) {
		return { weather: "cloudy", health: null, turbulence, enoughData, healthSignals, turbulenceSignals };
	}

	const score = weightedScore(healthSignals) as number;
	const health = input.overdueBills > 0 ? Math.min(score, OVERDUE_HEALTH_CAP) : score;
	return { weather: pickWeather(health, turbulence), health, turbulence, enoughData, healthSignals, turbulenceSignals };
}
