import { SuspenseOnSearchParams } from "@/components/layout/suspense-on-search-params";
import { requireAuth } from "@/lib/auth";
import { AllocationClient } from "./client";
import {
	getAllocation,
	getAllocationSummary,
	getTransactionsForMonth,
	getPreviousMonthSummary,
	getUserTemplates,
	getIncomeVerification,
} from "./actions";
import { getAccountsForSelector } from "@/lib/actions/unified-transaction-actions";
import { getAllocationContributions } from "@/lib/actions/contribution-actions";
import { getAllocationSettings, getTimezone } from "@/app/settings/actions";
import { formatDateString, getTodayDateString } from "@/lib/date-utils";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getDemoNow } from "@/mock-data/demo-date";
import { AllocationsLoadingSkeleton } from "./components/allocations-loading-skeleton";

export const metadata = {
	title: "Allocations | Pholio",
	description: "Your monthly budget",
};

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
	await requireAuth();

	let summary = null;
	let transactions: any[] = [];
	let accounts: any[] = [];
	let previousMonthData: { categoryCount: number; totalBudget: number; hasData: boolean } | null = null;

	const today = (await isSampleDataMode())
		? formatDateString(getDemoNow())
		: getTodayDateString((await getTimezone()) ?? undefined);

	const [userSettings, userTemplates, incomeVerification, contributions] = await Promise.all([
		getAllocationSettings(),
		getUserTemplates(),
		getIncomeVerification(year, month),
		getAllocationContributions(year, month),
	]);

	// Check if allocation exists (don't create yet - let dialog handle it)
	const existingAllocation = await getAllocation(year, month);

	if (existingAllocation) {
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
		previousMonthData = prevMonthResult.summary
			? {
					categoryCount: prevMonthResult.summary.categories?.length || 0,
					totalBudget: prevMonthResult.summary.summary?.total_budget_caps || 0,
					hasData: true,
				}
			: { categoryCount: 0, totalBudget: 0, hasData: false };
	}

	return (
		<AllocationClient
			initialYear={year}
			initialMonth={month}
			initialSummary={summary}
			initialTransactions={transactions}
			initialAccounts={accounts}
			initialContributions={contributions}
			previousMonthData={previousMonthData}
			incomeVerification={incomeVerification}
			userSettings={userSettings}
			templates={userTemplates}
			today={today}
		/>
	);
}
