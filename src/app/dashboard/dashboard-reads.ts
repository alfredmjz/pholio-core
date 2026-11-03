import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { parseLocalDate } from "@/lib/date-utils";
import type { LedgerRow } from "@/lib/financial-weather";
import { getAllocationSummary, getHistoricalPace } from "@/app/allocations/actions";
import { getRecurringExpenses } from "@/app/recurring/actions";
import type { AccountWithType } from "@/app/accounts/types";
import { rangeStartDate, type BalanceRecord } from "./net-worth-series";
import { cashflowWindowStart } from "./cashflow";

export const CASHFLOW_MONTHS = 6;

export interface DashboardReads {
	accounts: AccountWithType[];
	/** A year of balance history. */
	records: BalanceRecord[];
	/** Ledger rows inside the cashflow window. */
	ledger: LedgerRow[];
	allocationId: string | undefined;
}

/*
 * Dashboard and the weather backdrop (rendered by the root layout) need the same rows. These
 * wrappers make each read happen once per server render, whichever of the two asks first.
 */
export const getDashboardReads = cache(async (userId: string, today: string): Promise<DashboardReads> => {
	const supabase = await createClient();
	const todayDate = parseLocalDate(today);
	const year = todayDate.getFullYear();
	const month = todayDate.getMonth() + 1;

	const [accountsResult, historyResult, transactionsResult, allocationResult] = await Promise.all([
		supabase.from("accounts").select(`*, account_type:account_types(*)`).eq("user_id", userId).eq("is_active", true),
		supabase
			.from("account_history")
			.select("account_id, balance, recorded_at")
			.eq("user_id", userId)
			.gte("recorded_at", rangeStartDate("1Y", today))
			.order("recorded_at", { ascending: true }),
		supabase
			.from("transactions")
			.select("amount, transaction_date, source")
			.eq("user_id", userId)
			.gte("transaction_date", cashflowWindowStart(today, CASHFLOW_MONTHS))
			.lte("transaction_date", today),
		supabase.from("allocations").select("id").eq("user_id", userId).eq("year", year).eq("month", month).maybeSingle(),
	]);

	for (const [label, result] of Object.entries({
		accounts: accountsResult,
		history: historyResult,
		transactions: transactionsResult,
		allocation: allocationResult,
	})) {
		if (result.error) Logger.error(`Dashboard: error fetching ${label}`, { error: result.error });
	}

	return {
		accounts: (accountsResult.data ?? []) as AccountWithType[],
		records: (historyResult.data ?? []).map((h) => ({
			accountId: h.account_id,
			balance: Number(h.balance),
			date: String(h.recorded_at).slice(0, 10),
		})),
		ledger: (transactionsResult.data ?? []) as LedgerRow[],
		allocationId: (allocationResult.data as { id: string } | null)?.id,
	};
});

export const getAllocationSummaryOnce = cache(getAllocationSummary);
export const getHistoricalPaceOnce = cache(getHistoricalPace);
export const getRecurringExpensesOnce = cache(getRecurringExpenses);
