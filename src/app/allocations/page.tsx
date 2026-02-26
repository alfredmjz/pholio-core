import { SuspenseOnSearchParams } from "@/components/layout/suspense-on-search-params";
import { requireAuth } from "@/lib/auth";
import { AllocationClient } from "./client";
import {
	getAllocation,
	getAllocationSummary,
	getTransactionsForMonth,
	getPreviousMonthSummary,
	getHistoricalPace,
} from "./actions";
import { getAccountsForSelector } from "@/lib/actions/unified-transaction-actions";
import { getAllocationSettings } from "@/app/settings/actions";
import { AllocationsLoadingSkeleton } from "./components/allocations-loading-skeleton";

export default async function AllocationsPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string; month?: string }>;
}) {
	const params = await searchParams;
	const now = new Date();
	const year = params.year ? parseInt(params.year) : now.getFullYear();
	const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

	return (
		<SuspenseOnSearchParams
			searchParams={searchParams}
			fallback={<AllocationsLoadingSkeleton />}
			filterParams={["year", "month"]}
		>
			<AllocationsLoader year={year} month={month} />
		</SuspenseOnSearchParams>
	);
}

async function AllocationsLoader({ year, month }: { year: number; month: number }) {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA !== "true") {
		await requireAuth();
	}

	const now = new Date();

	let summary = null;
	let transactions: any[] = [];
	let accounts: any[] = [];
	let previousMonthData: { categoryCount: number; totalBudget: number; hasData: boolean } | null = null;

	const [userSettings, historicalPace] = await Promise.all([getAllocationSettings(), getHistoricalPace(year, month)]);

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		await new Promise((resolve) => setTimeout(resolve, 2000));

		const mockData = require("@/mock-data/allocations").getSmartMockData(year, month);
		summary = mockData.summary;
		transactions = mockData.transactions;

		accounts = await getAccountsForSelector();
	} else {
		// Check if allocation exists (don't create yet - let dialog handle it)
		const existingAllocation = await getAllocation(year, month);

		if (existingAllocation) {
			// Allocation exists - load its data
			[summary, transactions, accounts] = await Promise.all([
				getAllocationSummary(existingAllocation.id),
				getTransactionsForMonth(year, month),
				getAccountsForSelector(),
			]);
		} else {
			const [prevMonthResult, accountsResult] = await Promise.all([
				getPreviousMonthSummary(year, month),
				getAccountsForSelector(),
			]);

			accounts = accountsResult;

			if (prevMonthResult.summary) {
				previousMonthData = {
					categoryCount: prevMonthResult.summary.categories?.length || 0,
					totalBudget: prevMonthResult.summary.summary?.total_budget_caps || 0,
					hasData: true,
				};
			} else {
				previousMonthData = {
					categoryCount: 0,
					totalBudget: 0,
					hasData: false,
				};
			}
		}
	}

	return (
		<AllocationClient
			initialYear={year}
			initialMonth={month}
			initialSummary={summary}
			initialTransactions={transactions}
			initialAccounts={accounts}
			previousMonthData={previousMonthData}
			historicalPace={historicalPace}
			userSettings={userSettings}
		/>
	);
}
