"use client";

import { useState, useCallback, useEffect } from "react";
import type { RecurringExpense } from "@/app/recurring/actions";

export function useOptimisticRecurring(initialExpenses: RecurringExpense[]) {
	const [expenses, setExpenses] = useState<RecurringExpense[]>(initialExpenses);

	useEffect(() => {
		setExpenses(initialExpenses);
	}, [initialExpenses]);

	const optimisticallyAdd = useCallback((expense: RecurringExpense) => {
		setExpenses((prev) => [...prev, expense]);
	}, []);

	const optimisticallyUpdate = useCallback((id: string, updates: Partial<RecurringExpense>) => {
		setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)));
	}, []);

	const optimisticallyToggle = useCallback((id: string, isActive: boolean) => {
		setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, is_active: isActive } : exp)));
	}, []);

	const optimisticallyDelete = useCallback((id: string) => {
		setExpenses((prev) => prev.filter((exp) => exp.id !== id));
	}, []);

	const rollback = useCallback((previousExpenses: RecurringExpense[]) => {
		setExpenses(previousExpenses);
	}, []);

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
