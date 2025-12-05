'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, WifiOff, Loader2, LayoutGrid, Table2 } from 'lucide-react';
import { MonthSelector } from './components/MonthSelector';
import { SummaryCard } from './components/SummaryCard';
import { CategoryCard } from './components/CategoryCard';
import { TransactionsTable } from './components/TransactionsTable';
import { AddCategoryDialog } from './components/AddCategoryDialog';
import { useAllocationSync } from '@/hooks/useAllocationSync';
import { createCategory } from './actions';
import { toast } from 'sonner';
import { AllocationProvider } from './context/AllocationContext';
import type { MonthYear, AllocationSummary, Transaction, ViewMode } from './types';

interface AllocationClientProps {
	initialYear: number;
	initialMonth: number;
	initialSummary: AllocationSummary | null;
	initialTransactions: Transaction[];
}

export function AllocationClient({
	initialYear,
	initialMonth,
	initialSummary,
	initialTransactions,
}: AllocationClientProps) {
	const router = useRouter();

	const [currentMonth, setCurrentMonth] = useState<MonthYear>({
		year: initialYear,
		month: initialMonth,
	});
	const [view, setView] = useState<ViewMode>('overview');
	const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);

	// Use Realtime sync hook with optimistic updates
	const {
		summary,
		transactions,
		isConnected,
		isRefetching,
		optimisticallyAddCategory,
		optimisticallyUpdateBudget,
		optimisticallyUpdateName,
		optimisticallyDeleteCategory,
		rollback,
	} = useAllocationSync(
		initialSummary?.allocation.id || '',
		currentMonth.year,
		currentMonth.month,
		initialSummary,
		initialTransactions
	);

	// Handle month changes by navigating to new URL (triggers server-side data fetch)
	const handleMonthChange = (newMonth: MonthYear) => {
		setCurrentMonth(newMonth);
		router.push(`/allocations?year=${newMonth.year}&month=${newMonth.month}`);
	};

	const handleAddCategory = () => {
		setAddCategoryDialogOpen(true);
	};

	const handleAddCategorySubmit = async (name: string, budgetCap: number) => {
		if (!summary) return;

		// Save current state for rollback
		const previousSummary = summary;

		// 1. Optimistically update UI (instant feedback)
		const tempId = optimisticallyAddCategory(name, budgetCap);

		// 2. Send to server
		const newCategory = await createCategory(summary.allocation.id, name, budgetCap);

		if (newCategory) {
			toast.success('Category created');
			// Realtime subscription will sync the real data from server
		} else {
			// Rollback optimistic update on failure
			toast.error('Failed to create category');
			rollback(previousSummary);
		}
	};

	if (!summary) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">Failed to load allocation data</p>
				<Button onClick={() => window.location.reload()} className="mt-4">
					Retry
				</Button>
			</div>
		);
	}

	const categories = summary.categories || [];
	const transactionCount = transactions.length;

	return (
		<AllocationProvider
			value={{
				optimisticallyUpdateBudget,
				optimisticallyUpdateName,
				optimisticallyDeleteCategory,
				rollback,
			}}
		>
			<div className="max-w-7xl mx-auto w-full relative">
				{/* Connection Status Indicators */}
				{!isConnected && (
					<Badge variant="destructive" className="absolute top-0 right-0 z-10 gap-1.5">
						<WifiOff className="h-3 w-3" />
						Offline
					</Badge>
				)}
				{isRefetching && isConnected && (
					<div className="absolute top-0 right-0 z-10">
						<Badge variant="secondary" className="gap-1.5">
							<Loader2 className="h-3 w-3 animate-spin" />
							Syncing...
						</Badge>
					</div>
				)}

				{/* Sticky Header */}
				<div className="sticky top-0 z-20 bg-background pb-6 -mt-8 pt-8 mb-4">
					<div className="flex items-center justify-between">
						<MonthSelector currentMonth={currentMonth} onMonthChange={handleMonthChange} />

						<div className="flex items-center gap-3">
							<Button variant="outline" className="gap-2" onClick={() => toast.info('AI Insights coming soon!')}>
								<Sparkles className="h-4 w-4" />
								AI Insights
							</Button>
							<Button
								className="gap-2 bg-error hover:bg-error/90"
								onClick={() => toast.info('Quick add coming soon!')}
							>
								<Plus className="h-4 w-4" />
								New
							</Button>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="w-full">
					{/* View Toggle - Sticky */}
					<div className="sticky top-[72px] z-10 bg-background pb-6">
						<TabsList>
							<TabsTrigger value="overview" className="gap-2">
								<LayoutGrid className="h-4 w-4" />
								Allocations
							</TabsTrigger>
							<TabsTrigger value="transactions" className="gap-2">
								<Table2 className="h-4 w-4" />
								Transactions
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="overview" className="space-y-6">
						{/* Summary Card */}
						<SummaryCard summary={summary.summary} expectedIncome={summary.allocation.expected_income} />

						{/* Category Cards Grid */}
						{categories.length === 0 ? (
							<div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
								<p className="text-muted-foreground mb-4">
									No categories yet. Add your first category to start tracking your budget.
								</p>
								<Button onClick={handleAddCategory} className="gap-2">
									<Plus className="h-4 w-4" />
									Add Category
								</Button>
							</div>
						) : (
							<>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 group">
									{categories.map((category) => (
										<CategoryCard
											key={category.id}
											category={category}
											unallocatedFunds={summary.summary.unallocated_funds}
											totalIncome={summary.allocation.expected_income}
										/>
									))}
								</div>

								{/* Add Category Button */}
								<Button
									onClick={handleAddCategory}
									variant="outline"
									className="w-full border-dashed border-2 h-12 gap-2 hover:bg-muted"
								>
									<Plus className="h-4 w-4" />
									Add Category
								</Button>
							</>
						)}
					</TabsContent>

					<TabsContent value="transactions">
						<TransactionsTable transactions={transactions} categories={categories} />
					</TabsContent>
				</Tabs>

				<AddCategoryDialog
					open={addCategoryDialogOpen}
					onOpenChange={setAddCategoryDialogOpen}
					onSubmit={handleAddCategorySubmit}
					unallocatedFunds={summary?.summary.unallocated_funds || 0}
				/>
			</div>
		</AllocationProvider>
	);
}
