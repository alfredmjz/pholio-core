import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { BalanceSheetClient } from "./client";
import { getBalanceSheetSummary, getAccounts } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { sampleAccounts, sampleBalanceSheetSummary } from "@/mock-data/balancesheet";
import { BalanceSheetLoadingSkeleton } from "./components/balance-sheet-loading-skeleton";

export default async function BalanceSheetPage() {
	// Skip auth check if using sample data
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA !== "true") {
		await requireAuth();
	}

	let summary = null;
	let accounts: any[] = [];
	let categories: any[] = [];

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		summary = sampleBalanceSheetSummary;
		accounts = sampleAccounts;
		// Fetch categories for unified dialog even in sample mode
		const { data: cats } = await (await createClient()).from("allocation_categories").select("*");
		categories = cats || [];
	} else {
		// Fetch real data
		[summary, accounts] = await Promise.all([getBalanceSheetSummary(), getAccounts()]);

		const { data: cats } = await (await createClient()).from("allocation_categories").select("*");
		categories = cats || [];
	}

	// Artificial delay to show skeleton in dev/mock mode
	if (process.env.NODE_ENV === "development") {
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}

	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<BalanceSheetClient
				initialAccounts={accounts}
				initialCategories={categories}
				initialSummary={{
					...summary,
					totalAssets: summary.totalAssets,
					totalLiabilities: summary.totalLiabilities,
					netWorth: summary.netWorth,
				}}
			/>
		</div>
	);
}
