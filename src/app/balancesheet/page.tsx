import { requireAuth } from "@/lib/auth";
import { BalanceSheetClient } from "./client";
import { getBalanceSheetSummary, getAccounts, getRecentActivity } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { sampleAccounts, getSampleBalanceSheetSummary, getSampleRecentActivity } from "@/mock-data/balancesheet";
import { isSampleDataMode } from "@/lib/demo-mode.server";

export default async function BalanceSheetPage() {
	const sampleMode = await isSampleDataMode();

	// Skip auth check if using sample data
	if (!sampleMode) {
		await requireAuth();
	}

	let summary = null;
	let accounts: any[] = [];
	let categories: any[] = [];
	let activity: any[] = [];

	if (sampleMode) {
		summary = getSampleBalanceSheetSummary();
		accounts = sampleAccounts;
		activity = getSampleRecentActivity();
		// Fetch categories for unified dialog even in sample mode
		const { data: cats } = await (await createClient()).from("allocation_categories").select("*");
		categories = cats || [];
	} else {
		// Fetch real data
		[summary, accounts, activity] = await Promise.all([getBalanceSheetSummary(), getAccounts(), getRecentActivity()]);

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
				initialActivity={activity}
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
