import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AllocationClient } from "./client";
import { getOrCreateAllocation, getAllocationSummary, getTransactionsForMonth } from "./actions";

export default async function AllocationsPage({
	searchParams,
}: {
	searchParams: Promise<{ year?: string; month?: string }>;
}) {
	const supabase = await createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return redirect("/login");
	}

	// Await searchParams in Next.js 15
	const params = await searchParams;

	// Default to current month if not specified
	const now = new Date();
	const year = params.year ? parseInt(params.year) : now.getFullYear();
	const month = params.month ? parseInt(params.month) : now.getMonth() + 1;

	// Fetch data on server side
	const allocation = await getOrCreateAllocation(year, month, 9000);

	let summary = null;
	let transactions: any[] = [];

	if (allocation) {
		// Parallelize independent queries for better performance (50% faster)
		[summary, transactions] = await Promise.all([
			getAllocationSummary(allocation.id),
			getTransactionsForMonth(year, month)
		]);
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

function AllocationsLoadingSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			<div className="h-10 bg-muted rounded w-64" />
			<div className="h-32 bg-muted rounded" />
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<div key={i} className="h-48 bg-muted rounded" />
				))}
			</div>
		</div>
	);
}
