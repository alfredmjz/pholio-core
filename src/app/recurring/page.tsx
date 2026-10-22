import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getRecurringExpenses, getRecurringCategoryOptions } from "./actions";
import { getTimezone } from "@/app/settings/actions";
import { RecurringClient } from "./components/client";
import { RecurringLoadingSkeleton } from "./components/recurring-loading-skeleton";

export const metadata = {
	title: "Recurring | Pholio",
	description: "Your bills and subscriptions",
};

export default async function RecurringPage() {
	await requireAuth();

	const [expenses, timezone, categoryOptions] = await Promise.all([
		getRecurringExpenses(),
		getTimezone(),
		getRecurringCategoryOptions(),
	]);

	return (
		<Suspense fallback={<RecurringLoadingSkeleton />}>
			<RecurringClient initialExpenses={expenses || []} timezone={timezone} categoryOptions={categoryOptions || []} />
		</Suspense>
	);
}
