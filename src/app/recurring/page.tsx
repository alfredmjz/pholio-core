import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getRecurringExpenses, getRecurringCategoryOptions } from "./actions";
import { getTimezone } from "@/app/settings/actions";
import { getAccountsForSelector } from "@/lib/actions/unified-transaction-actions";
import { RecurringClient } from "./components/client";
import { RecurringLoadingSkeleton } from "./components/recurring-loading-skeleton";

export const metadata = {
	title: "Recurring | Pholio",
	description: "Your bills and subscriptions",
};

export default async function RecurringPage() {
	await requireAuth();

	const [expenses, timezone, categoryOptions, accounts] = await Promise.all([
		getRecurringExpenses(),
		getTimezone(),
		getRecurringCategoryOptions(),
		getAccountsForSelector(),
	]);

	return (
		<Suspense fallback={<RecurringLoadingSkeleton />}>
			<RecurringClient
				initialExpenses={expenses || []}
				timezone={timezone}
				categoryOptions={categoryOptions || []}
				accounts={accounts}
			/>
		</Suspense>
	);
}
