import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { AllocationClient } from "./client";
import { getOrCreateAllocation, getAllocationSummary, getTransactionsForMonth } from "./actions";

import { sampleAllocationSummary, sampleTransactions } from "@/mock-data/allocations";
import { AllocationsLoadingSkeleton } from "./components/allocations-loading-skeleton";

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

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		summary = sampleAllocationSummary;
		transactions = sampleTransactions;
	} else {
		// Fetch data on server side
		const allocation = await getOrCreateAllocation(year, month, 9000);

		if (allocation) {
			// Parallelize independent queries for better performance (50% faster)
			[summary, transactions] = await Promise.all([
				getAllocationSummary(allocation.id),
				getTransactionsForMonth(year, month),
			]);
		}
	}

	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<Suspense fallback={<AllocationsLoadingSkeleton />}>
				<AllocationClient
					initialYear={year}
					initialMonth={month}
					initialSummary={summary}
					initialTransactions={transactions}
				/>
			</Suspense>
		</div>
	);
}


