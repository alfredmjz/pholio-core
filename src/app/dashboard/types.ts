/**
 * Dashboard Types
 * Everything the dashboard page renders, assembled on the server by `getDashboardData`.
 */

import type { AccountWithType } from "@/app/balancesheet/types";
import type { AllocationCategory } from "@/app/allocations/types";
import type { NetWorthPoint } from "./net-worth-series";
import type { MonthPace } from "./month-pace";
import type { CashflowMonth } from "./cashflow";
import type { HeadsUpItem, UpcomingBill } from "./heads-up";

export interface Transaction {
	id: string;
	date: string;
	description: string;
	category: string;
	amount: number;
	type: "income" | "expense" | "transfer";
	account?: string;
}

export interface DashboardAccount {
	id: string;
	name: string;
	institution: string | null;
	typeName: string;
	class: "asset" | "liability";
	balance: number;
}

export interface DashboardData {
	/** YYYY-MM-DD the data was computed for. */
	today: string;
	netWorth: {
		current: number;
		totalAssets: number;
		totalLiabilities: number;
		/** Up to a year of history, ending today. */
		history: NetWorthPoint[];
	};
	accountsSummary: DashboardAccount[];
	/** Null when there is no budget for this month yet. */
	monthPace: MonthPace | null;
	cashflow: CashflowMonth[];
	upcomingBills: UpcomingBill[];
	headsUp: HeadsUpItem[];
	recentTransactions: Transaction[];
	/** Raw account/category lists for the dashboard's transaction dialog. */
	accounts?: AccountWithType[];
	categories?: AllocationCategory[];
}
