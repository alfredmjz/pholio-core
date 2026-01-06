"use client";

import { useState, useCallback } from "react";
import type { RecurringExpense } from "@/app/recurring/actions";

/**
 * Hook for optimistic UI updates on recurring expenses
 * Updates local state immediately, then relies on server revalidation to sync
 */
export function useOptimisticRecurring(initialExpenses: RecurringExpense[]) {
	const [expenses, setExpenses] = useState<RecurringExpense[]>(initialExpenses);

	/**
	 * Optimistically add a new recurring expense
	 */
	const optimisticallyAdd = useCallback((expense: RecurringExpense) => {
		setExpenses((prev) => [...prev, expense]);
	}, []);

	/**
	 * Optimistically update an existing expense
	 */
	const optimisticallyUpdate = useCallback((id: string, updates: Partial<RecurringExpense>) => {
		setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)));
	}, []);

	/**
	 * Optimistically toggle active status
	 */
	const optimisticallyToggle = useCallback((id: string, isActive: boolean) => {
		setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, is_active: isActive } : exp)));
	}, []);

	/**
	 * Optimistically delete an expense
	 */
	const optimisticallyDelete = useCallback((id: string) => {
		setExpenses((prev) => prev.filter((exp) => exp.id !== id));
	}, []);

	/**
	 * Rollback optimistic update (if server action fails)
	 */
	const rollback = useCallback((previousExpenses: RecurringExpense[]) => {
		setExpenses(previousExpenses);
	}, []);

	/**
	 * Sync with server data (from Realtime or refetch)
	 */
	const syncWithServer = useCallback((serverExpenses: RecurringExpense[]) => {
		setExpenses(serverExpenses);
	}, []);

	return {
		expenses,
		setExpenses,
		optimisticallyAdd,
		optimisticallyUpdate,
		optimisticallyToggle,
		optimisticallyDelete,
		rollback,
		syncWithServer,
	};
}
