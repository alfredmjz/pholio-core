import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getRecurringExpenses, getRecurringCategoryOptions } from "./actions";
import { getTimezone } from "@/app/settings/actions";
import { RecurringClient } from "./components/client";
import { RecurringLoadingSkeleton } from "./components/recurring-loading-skeleton";

export default async function RecurringPage() {
	await requireAuth();

	const [expenses, timezone, categoryOptions] = await Promise.all([
		getRecurringExpenses(),
		getTimezone(),
		getRecurringCategoryOptions(),
	]);

	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<Suspense fallback={<RecurringLoadingSkeleton />}>
				<RecurringClient
					initialExpenses={expenses || []}
					timezone={timezone}
					categoryOptions={categoryOptions || []}
				/>
			</Suspense>
		</div>
	);
}
