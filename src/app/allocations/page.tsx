import { requireAuth } from "@/lib/auth";
import { AllocationClient } from "./client";
import { getAllocation, getAllocationSummary, getTransactionsForMonth, getPreviousMonthSummary } from "./actions";
import { getAccountsForSelector } from "@/lib/actions/unified-transaction-actions";
import { getAllocationSettings } from "@/app/settings/actions";

import { sampleAllocationSummary, sampleTransactions } from "@/mock-data/allocations";

export default async function AllocationsPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string; month?: string }>;
}) {
	// Require authentication - automatically redirects to /login if not authenticated
	// Skip auth check if using sample data to allow easy dev
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA !== "true") {
		await requireAuth();
	}

	// Await searchParams in Next.js 15
	const params = await searchParams;

	// Default to current month if not specified
	const now = new Date();
	const year = params.year ? parseInt(params.year) : now.getFullYear();
	const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

	let summary = null;
	let transactions: any[] = [];
	let accounts: any[] = [];
	let previousMonthData: { categoryCount: number; totalBudget: number; hasData: boolean } | null = null;

	// Fetch user settings
	const userSettings = await getAllocationSettings();

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		summary = sampleAllocationSummary;
		transactions = sampleTransactions;
		// Initialize accounts with sample data if needed, or just let it fetch
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
			// No allocation yet - fetch previous month data for dialog preview
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
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<AllocationClient
				initialYear={year}
				initialMonth={month}
				initialSummary={summary}
				initialTransactions={transactions}
				initialAccounts={accounts}
				previousMonthData={previousMonthData}
				userSettings={userSettings}
			/>
		</div>
	);
}
