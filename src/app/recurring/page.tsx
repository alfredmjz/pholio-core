import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getRecurringExpenses } from "./actions";
import { RecurringClient } from "./components/client";
import { RecurringLoadingSkeleton } from "./components/recurring-loading-skeleton";

export default async function RecurringPage() {
    await requireAuth();

    const expenses = await getRecurringExpenses();

    return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
            <Suspense fallback={<RecurringLoadingSkeleton />}>
                <RecurringClient initialExpenses={expenses || []} />
            </Suspense>
        </div>
    );
}
