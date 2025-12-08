"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import type { AllocationSummary, Transaction } from "@/app/allocations/types";
import { getAllocationSummary, getTransactionsForMonth } from "@/app/allocations/actions";
import { toast } from "sonner";
import { useOptimisticAllocation } from "./useOptimisticAllocation";
import { useState } from "react";

interface UseAllocationSyncReturn {
	summary: AllocationSummary | null;
	transactions: Transaction[];
	isConnected: boolean;
	isRefetching: boolean;
	optimisticallyAddCategory: (name: string, budgetCap: number) => string | null;
	optimisticallyUpdateBudget: (categoryId: string, newBudget: number) => void;
	optimisticallyUpdateName: (categoryId: string, newName: string) => void;
	optimisticallyDeleteCategory: (categoryId: string) => void;
	rollback: (previousSummary: AllocationSummary) => void;
}

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
	const {
		summary,
		setSummary,
		optimisticallyAddCategory,
		optimisticallyUpdateBudget,
		optimisticallyUpdateName,
		optimisticallyDeleteCategory,
		rollback,
		syncWithServer,
	} = useOptimisticAllocation(initialSummary);

	const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
	const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hasShownDisconnectToast = useRef(false);

	// Debounced refetch function to prevent excessive refetches
	const scheduleRefetch = () => {
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

				if (freshSummary) syncWithServer(freshSummary);
				setTransactions(freshTransactions);
			} catch (error) {
				console.error("Error refetching allocation data:", error);
				toast.error("Failed to sync data. Please refresh the page.");
			} finally {
				setIsRefetching(false);
			}
		}, 300); // 300ms debounce
	};

	// Update state when initial props change (e.g., month navigation)
	useEffect(() => {
		if (initialSummary) syncWithServer(initialSummary);
		setTransactions(initialTransactions);
	}, [initialSummary, initialTransactions, syncWithServer]);

	// Subscribe to Realtime changes
	useEffect(() => {
		if (!allocationId) return;

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
				(payload) => {
					console.log("Category changed:", payload);
					scheduleRefetch();
				}
			)
			.subscribe((status) => {
				if (status === "SUBSCRIBED") {
					console.log("Subscribed to allocation_categories changes");
				}
			});

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
				(payload) => {
					console.log("Transaction changed:", payload);
					scheduleRefetch();
				}
			)
			.subscribe((status) => {
				if (status === "SUBSCRIBED") {
					console.log("Subscribed to transactions changes");
				}
			});

		// Monitor connection status
		const connectionChannel = supabase.channel("connection-monitor");

		connectionChannel
			.on("system", { event: "*" }, (payload) => {
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

		// Cleanup function
		return () => {
			if (refetchTimeoutRef.current) {
				clearTimeout(refetchTimeoutRef.current);
			}
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
		optimisticallyAddCategory,
		optimisticallyUpdateBudget,
		optimisticallyUpdateName,
		optimisticallyDeleteCategory,
		rollback,
	};
}
