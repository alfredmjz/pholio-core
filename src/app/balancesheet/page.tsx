import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { BalanceSheetClient } from "./client";
import { getBalanceSheetSummary, getAccounts } from "./actions";
import { sampleAccounts, sampleBalanceSheetSummary } from "@/mock-data/balancesheet";
import { BalanceSheetLoadingSkeleton } from "./components/balance-sheet-loading-skeleton";

export default async function BalanceSheetPage() {
	// Skip auth check if using sample data
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA !== "true") {
		await requireAuth();
	}

	let summary = null;
	let accounts: any[] = [];

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		summary = sampleBalanceSheetSummary;
		accounts = sampleAccounts;
	} else {
		// Fetch real data
		summary = await getBalanceSheetSummary();
		accounts = await getAccounts();
	}

	return (
		<div className="flex-1 w-full">
			<Suspense fallback={<BalanceSheetLoadingSkeleton />}>
				<BalanceSheetClient
					initialAccounts={accounts}
					initialSummary={{
						totalAssets: summary.totalAssets,
						totalLiabilities: summary.totalLiabilities,
						netWorth: summary.netWorth,
					}}
				/>
			</Suspense>
		</div>
	);
}
