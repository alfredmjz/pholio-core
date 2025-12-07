'use client';

import { useState, useCallback } from 'react';
import type { AllocationSummary, AllocationCategory } from '@/app/allocations/types';

/**
 * Hook for optimistic UI updates
 * Updates local state immediately, then relies on Realtime to sync the truth
 */
export function useOptimisticAllocation(initialSummary: AllocationSummary | null) {
	const [summary, setSummary] = useState<AllocationSummary | null>(initialSummary);

	/**
	 * Optimistically add a new category
	 * Creates a temporary category with estimated values
	 */
	const optimisticallyAddCategory = useCallback(
		(name: string, budgetCap: number) => {
			if (!summary || !summary.categories) return null;

			const tempId = `temp-${Date.now()}`;
			const newCategory: AllocationCategory = {
				id: tempId,
				allocation_id: summary.allocation.id,
				user_id: summary.allocation.user_id,
				name,
				budget_cap: budgetCap,
				actual_spend: 0,
				remaining: budgetCap,
				utilization_percentage: 0,
				transaction_count: 0,
				is_recurring: false,
				display_order: summary.categories.length,
				color: undefined,
				icon: undefined,
				notes: undefined,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};

			const newSummary: AllocationSummary = {
				...summary,
				categories: [...summary.categories, newCategory],
				summary: {
					...summary.summary,
					total_budget_caps: summary.summary.total_budget_caps + budgetCap,
					unallocated_funds: summary.summary.unallocated_funds - budgetCap,
				},
			};

			setSummary(newSummary);
			return tempId;
		},
		[summary]
	);

	/**
	 * Optimistically update category budget
	 */
	const optimisticallyUpdateBudget = useCallback(
		(categoryId: string, newBudget: number) => {
			if (!summary) return;

			const categoryIndex = summary.categories.findIndex((c) => c.id === categoryId);
			if (categoryIndex === -1) return;

			const oldCategory = summary.categories[categoryIndex];
			if (!oldCategory) return;
			const oldBudget = oldCategory.budget_cap;
			const budgetDiff = newBudget - oldBudget;

			const updatedCategories = [...summary.categories];
			const category = updatedCategories[categoryIndex];
			if (!category) return;

			const actualSpend = category.actual_spend || 0;
			updatedCategories[categoryIndex] = {
				...category,
				budget_cap: newBudget,
				remaining: newBudget - actualSpend,
				utilization_percentage:
					newBudget > 0
						? Number(
								(
									(actualSpend / newBudget) *
									100
								).toFixed(2)
						  )
						: 0,
			};

			const newSummary: AllocationSummary = {
				...summary,
				categories: updatedCategories,
				summary: {
					...summary.summary,
					total_budget_caps: summary.summary.total_budget_caps + budgetDiff,
					unallocated_funds: summary.summary.unallocated_funds - budgetDiff,
				},
			};

			setSummary(newSummary);
		},
		[summary]
	);

	/**
	 * Optimistically update category name
	 */
	const optimisticallyUpdateName = useCallback(
		(categoryId: string, newName: string) => {
			if (!summary) return;

			const updatedCategories = summary.categories.map((cat) =>
				cat.id === categoryId ? { ...cat, name: newName } : cat
			);

			setSummary({
				...summary,
				categories: updatedCategories,
			});
		},
		[summary]
	);

	/**
	 * Optimistically delete a category
	 */
	const optimisticallyDeleteCategory = useCallback(
		(categoryId: string) => {
			if (!summary) return;

			const category = summary.categories.find((c) => c.id === categoryId);
			if (!category) return;

			const updatedCategories = summary.categories.filter((c) => c.id !== categoryId);

			const newSummary: AllocationSummary = {
				...summary,
				categories: updatedCategories,
				summary: {
					...summary.summary,
					total_budget_caps: summary.summary.total_budget_caps - category.budget_cap,
					unallocated_funds: summary.summary.unallocated_funds + category.budget_cap,
				},
			};

			setSummary(newSummary);
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
		optimisticallyAddCategory,
		optimisticallyUpdateBudget,
		optimisticallyUpdateName,
		optimisticallyDeleteCategory,
		rollback,
		syncWithServer,
	};
}
