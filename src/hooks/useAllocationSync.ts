"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { AllocationSummary, Transaction, AllocationCategory } from "@/app/allocations/types";
import { getAllocationSummary, getTransactionsForMonth, reorderCategories } from "@/app/allocations/actions";
import { toast } from "sonner";
import { useOptimisticAllocation } from "./useOptimisticAllocation";

interface UseAllocationSyncReturn {
	summary: AllocationSummary | null;
	transactions: Transaction[];
	isConnected: boolean;
	isRefetching: boolean;
	optimisticallyReorderCategories: (newCategories: AllocationCategory[]) => void;
	rollback: (previousSummary: AllocationSummary) => void;
	/** Shows the new order at once and saves it; resolves to whether the save worked. */
	saveCategoryOrder: (newCategories: AllocationCategory[]) => Promise<boolean>;
}

/** Coming back to the tab refetches only when the data is older than this. */
const FOCUS_REFRESH_MS = 60_000;

const sameData = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Custom hook for Realtime synchronization of allocation data
 *
 * Subscribes to Supabase Realtime events on allocation_categories and transactions tables.
 * Automatically refetches data when changes occur in the database.
 *
 * @param allocationId - The allocation ID to monitor
 * @param year - The year for transaction filtering
 * @param month - The month for transaction filtering
 * @param initialSummary - Initial allocation summary from server
 * @param initialTransactions - Initial transactions from server
 * @returns Reactive state with summary, transactions, connection status, and refetching status
 */
export function useAllocationSync(
	allocationId: string,
	year: number,
	month: number,
	initialSummary: AllocationSummary | null,
	initialTransactions: Transaction[]
): UseAllocationSyncReturn {
	const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
	const [isConnected, setIsConnected] = useState(true);
	const [isRefetching, setIsRefetching] = useState(false);

	// Use optimistic updates hook
	const { summary, optimisticallyReorderCategories, rollback, syncWithServer } =
		useOptimisticAllocation(initialSummary);

	const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hasShownDisconnectToast = useRef(false);
	const summaryRef = useRef(summary);
	summaryRef.current = summary;
	const transactionsRef = useRef(transactions);
	transactionsRef.current = transactions;
	const lastFetchedAt = useRef(Date.now());
	// While a reorder saves, each row's update fires a Realtime event; a refetch then would show
	// the rows half saved and swap them back. Refetches wait and run once the save is done.
	const savesInFlight = useRef(0);
	const refetchWaiting = useRef(false);

	// Debounced refetch function to prevent excessive refetches
	const scheduleRefetch = () => {
		if (savesInFlight.current > 0) {
			refetchWaiting.current = true;
			return;
		}
		if (refetchTimeoutRef.current) {
			clearTimeout(refetchTimeoutRef.current);
		}

		refetchTimeoutRef.current = setTimeout(async () => {
			if (!allocationId) return;

			setIsRefetching(true);
			try {
				const [freshSummary, freshTransactions] = await Promise.all([
					getAllocationSummary(allocationId),
					getTransactionsForMonth(year, month),
				]);

				lastFetchedAt.current = Date.now();
				// Unchanged data is not applied, so nothing on the page re-renders or re-animates.
				if (freshSummary && !sameData(freshSummary, summaryRef.current)) syncWithServer(freshSummary);
				if (!sameData(freshTransactions, transactionsRef.current)) setTransactions(freshTransactions);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Connection or server error.";
				toast.error("Sync Failed", {
					description: `Failed to refresh your budget data. ${errorMessage}`,
				});
			} finally {
				setIsRefetching(false);
			}
		}, 300); // 300ms debounce
	};

	// Update state when initial props change (e.g., month navigation)
	useEffect(() => {
		lastFetchedAt.current = Date.now();
		if (initialSummary && !sameData(initialSummary, summaryRef.current)) syncWithServer(initialSummary);
		if (!sameData(initialTransactions, transactionsRef.current)) setTransactions(initialTransactions);
	}, [initialSummary, initialTransactions, syncWithServer]);

	const saveCategoryOrder = async (newCategories: AllocationCategory[]) => {
		const ordered = newCategories.map((category, index) => ({ ...category, display_order: index }));
		optimisticallyReorderCategories(ordered);
		savesInFlight.current += 1;
		try {
			return await reorderCategories(ordered.map(({ id, display_order }) => ({ id, display_order })));
		} finally {
			savesInFlight.current -= 1;
			if (savesInFlight.current === 0 && refetchWaiting.current) {
				refetchWaiting.current = false;
				scheduleRefetch();
			}
		}
	};

	// Subscribe to Realtime changes
	useEffect(() => {
		if (!allocationId || process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") return;

		// Subscribe to allocation_categories changes
		const categoriesChannel = supabase
			.channel(`allocation-categories-${allocationId}`)
			.on(
				"postgres_changes",
				{
					event: "*", // INSERT, UPDATE, DELETE
					schema: "public",
					table: "allocation_categories",
					filter: `allocation_id=eq.${allocationId}`,
				},
				(payload: any) => {
					scheduleRefetch();
				}
			)
			.subscribe();

		// Subscribe to transactions changes (for future transaction feature)
		// Note: You may need to add year/month columns to transactions table
		// or use a different filtering strategy
		const transactionsChannel = supabase
			.channel(`transactions-${year}-${month}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "transactions",
					// TODO: Add filter when transactions table has proper year/month columns
					// filter: `year=eq.${year},month=eq.${month}`,
				},
				(payload: any) => {
					scheduleRefetch();
				}
			)
			.subscribe();

		// Monitor connection status
		const connectionChannel = supabase.channel("connection-monitor");

		connectionChannel
			.on("system", { event: "*" }, (payload: any) => {
				if (payload.type === "connected") {
					setIsConnected(true);
					if (hasShownDisconnectToast.current) {
						toast.success("Connected. Data synced.");
						hasShownDisconnectToast.current = false;
					}
				} else if (payload.type === "disconnected") {
					setIsConnected(false);
					if (!hasShownDisconnectToast.current) {
						toast.warning("Connection lost. Reconnecting...");
						hasShownDisconnectToast.current = true;
					}
				}
			})
			.subscribe();

		// Refetch when the tab regains focus so changes made elsewhere (for example
		// deleting an account, which nulls the linked account transaction) show up.
		const handleFocus = () => {
			if (document.visibilityState === "visible" && Date.now() - lastFetchedAt.current >= FOCUS_REFRESH_MS) {
				scheduleRefetch();
			}
		};
		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleFocus);

		// Cleanup function
		return () => {
			if (refetchTimeoutRef.current) {
				clearTimeout(refetchTimeoutRef.current);
			}
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleFocus);
			supabase.removeChannel(categoriesChannel);
			supabase.removeChannel(transactionsChannel);
			supabase.removeChannel(connectionChannel);
		};
	}, [allocationId, year, month]);

	return {
		summary,
		transactions,
		isConnected,
		isRefetching,
		optimisticallyReorderCategories,
		rollback,
		saveCategoryOrder,
	};
}
