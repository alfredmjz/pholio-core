"use client";

import { useState, useCallback } from "react";
import type { AllocationSummary, AllocationCategory } from "@/app/allocations/types";

/**
 * Hook for optimistic UI updates
 * Updates local state immediately, then relies on Realtime to sync the truth
 */
export function useOptimisticAllocation(initialSummary: AllocationSummary | null) {
	const [summary, setSummary] = useState<AllocationSummary | null>(initialSummary);

	/**
	 * Optimistically reorder categories
	 */
	const optimisticallyReorderCategories = useCallback(
		(newCategories: AllocationCategory[]) => {
			if (!summary) return;

			setSummary({
				...summary,
				categories: newCategories,
			});
		},
		[summary]
	);

	/**
	 * Rollback optimistic update (if server action fails)
	 */
	const rollback = useCallback((previousSummary: AllocationSummary) => {
		setSummary(previousSummary);
	}, []);

	/**
	 * Sync with server data (from Realtime or refetch)
	 */
	const syncWithServer = useCallback((serverSummary: AllocationSummary) => {
		setSummary(serverSummary);
	}, []);

	return {
		summary,
		setSummary,
		optimisticallyReorderCategories,
		rollback,
		syncWithServer,
	};
}
