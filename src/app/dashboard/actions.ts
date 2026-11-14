"use server";

import { getReadContext } from "@/lib/data-context.server";
import { getTodayDateString } from "@/lib/date-utils";
import type { DashboardData, Transaction } from "./types";
import { dashboardStore, emptyDashboardData } from "./dashboard-store";

/** All dashboard data for the current user. Reads only: nothing here creates allocations or syncs recurring items. */
export async function getDashboardData(): Promise<DashboardData> {
	const ctx = await getReadContext();
	return ctx ? dashboardStore(ctx).getData() : emptyDashboardData(getTodayDateString());
}

export async function getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
	const ctx = await getReadContext();
	return ctx ? dashboardStore(ctx).recentTransactions(limit) : [];
}
