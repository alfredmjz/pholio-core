"use client";

import { useEffect, useRef, useState } from "react";
import type { AllocationPageData, AllocationSummary, Transaction, AllocationCategory } from "@/app/allocations/types";
import { getAllocationPageData } from "@/app/allocations/actions";
import { toast } from "sonner";
import { useOptimisticAllocation } from "./useOptimisticAllocation";

interface UseAllocationSyncReturn {
	summary: AllocationSummary | null;
	transactions: Transaction[];
	isRefetching: boolean;
	optimisticallyReorderCategories: (newCategories: AllocationCategory[]) => void;
	rollback: (previousSummary: AllocationSummary) => void;
}

/** Coming back to the tab refetches only when the data is older than this. */
const FOCUS_REFRESH_MS = 60_000;

export const sameData = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Keeps the Allocations page in sync with the server.
 *
 * Saves on the page refresh it through revalidatePath / router.refresh, which re-seeds this hook
 * from the new server props. Changes made elsewhere (another tab or device) arrive when the tab
 * regains focus, at most once per FOCUS_REFRESH_MS, with one request for the whole page.
 *
 * @param allocationId - The month's allocation, or "" for a month without a budget
 * @param year - The year for transaction filtering
 * @param month - The month for transaction filtering
 * @param initialSummary - Initial allocation summary from server
 * @param initialTransactions - Initial transactions from server
 * @param onRefetched - Receives every refetch, for the page's accounts and contributions
 */
export function useAllocationSync(
	allocationId: string,
	year: number,
	month: number,
	initialSummary: AllocationSummary | null,
	initialTransactions: Transaction[],
	onRefetched?: (data: AllocationPageData) => void
): UseAllocationSyncReturn {
	const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
	const [isRefetching, setIsRefetching] = useState(false);

	const { summary, optimisticallyReorderCategories, rollback, syncWithServer } =
		useOptimisticAllocation(initialSummary);

	const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const summaryRef = useRef(summary);
	summaryRef.current = summary;
	const transactionsRef = useRef(transactions);
	transactionsRef.current = transactions;
	const onRefetchedRef = useRef(onRefetched);
	onRefetchedRef.current = onRefetched;
	const lastFetchedAt = useRef(Date.now());

	// Update state when initial props change (e.g., month navigation, or a save on the page)
	useEffect(() => {
		lastFetchedAt.current = Date.now();
		if (initialSummary && !sameData(initialSummary, summaryRef.current)) syncWithServer(initialSummary);
		if (!sameData(initialTransactions, transactionsRef.current)) setTransactions(initialTransactions);
	}, [initialSummary, initialTransactions, syncWithServer]);

	// Refetch when the tab regains focus so changes made elsewhere (for example
	// deleting an account, which nulls the linked account transaction) show up.
	// Runs on an empty month too, where accounts and contributions still refresh.
	useEffect(() => {
		const refetch = () => {
			if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);

			// focus and visibilitychange fire together; the debounce sends one request
			refetchTimeoutRef.current = setTimeout(async () => {
				setIsRefetching(true);
				try {
					const fresh = await getAllocationPageData(allocationId || null, year, month);
					// A server action from an older deployment (or a dev rebuild) resolves to undefined.
					if (!fresh) return;

					lastFetchedAt.current = Date.now();
					// Unchanged data is not applied, so nothing on the page re-renders or re-animates.
					if (fresh.summary && !sameData(fresh.summary, summaryRef.current)) syncWithServer(fresh.summary);
					if (!sameData(fresh.transactions, transactionsRef.current)) setTransactions(fresh.transactions);
					onRefetchedRef.current?.(fresh);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Connection or server error.";
					toast.error("Sync Failed", {
						description: `Failed to refresh your budget data. ${errorMessage}`,
					});
				} finally {
					setIsRefetching(false);
				}
			}, 300);
		};

		const handleFocus = () => {
			if (document.visibilityState === "visible" && Date.now() - lastFetchedAt.current >= FOCUS_REFRESH_MS) {
				refetch();
			}
		};
		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleFocus);

		return () => {
			if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleFocus);
		};
	}, [allocationId, year, month, syncWithServer]);

	return {
		summary,
		transactions,
		isRefetching,
		optimisticallyReorderCategories,
		rollback,
	};
}
