"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Plus } from "lucide-react";
import { MonthSelector } from "./components/MonthSelector";
import { SummaryCard } from "./components/SummaryCard";
import { CategoryCard } from "./components/CategoryCard";
import { TransactionsTable } from "./components/TransactionsTable";
import { AddCategoryDialog } from "./components/AddCategoryDialog";
import {
	getOrCreateAllocation,
	getAllocationSummary,
	getTransactionsForMonth,
	createCategory,
} from "./actions";
import { toast } from "sonner";
import type {
	MonthYear,
	AllocationSummary,
	Transaction,
	ViewMode,
} from "./types";

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
	const searchParams = useSearchParams();

	const [currentMonth, setCurrentMonth] = useState<MonthYear>({
		year: initialYear,
		month: initialMonth,
	});
	const [view, setView] = useState<ViewMode>("overview");
	const [summary, setSummary] = useState<AllocationSummary | null>(initialSummary);
	const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
	const [isLoading, setIsLoading] = useState(false);
	const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);

	// Handle month changes by navigating to new URL (triggers server-side data fetch)
	const handleMonthChange = (newMonth: MonthYear) => {
		setCurrentMonth(newMonth);
		router.push(
			`/allocations?year=${newMonth.year}&month=${newMonth.month}`
		);
	};


	const handleAddCategory = () => {
		setAddCategoryDialogOpen(true);
	};

	const handleAddCategorySubmit = async (name: string, budgetCap: number) => {
		if (!summary) return;

		const newCategory = await createCategory(
			summary.allocation.id,
			name,
			budgetCap
		);

		if (newCategory) {
			toast.success("Category created");
			router.refresh(); // Trigger server-side data refetch
		} else {
			toast.error("Failed to create category");
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6 animate-pulse">
				<div className="h-10 bg-neutral-200 rounded w-64" />
				<div className="h-32 bg-neutral-200 rounded" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div key={i} className="h-48 bg-neutral-200 rounded" />
					))}
				</div>
			</div>
		);
	}

	if (!summary) {
		return (
			<div className="text-center py-12">
				<p className="text-neutral-600">Failed to load allocation data</p>
				<Button onClick={() => router.refresh()} className="mt-4">
					Retry
				</Button>
			</div>
		);
	}

	const categories = summary.categories || [];
	const transactionCount = transactions.length;

	return (
		<div className="max-w-7xl mx-auto w-full">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<MonthSelector
					currentMonth={currentMonth}
					onMonthChange={handleMonthChange}
				/>

				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						className="gap-2"
						onClick={() => toast.info("AI Insights coming soon!")}
					>
						<Sparkles className="h-4 w-4" />
						AI Insights
					</Button>
					<Button
						className="gap-2 bg-red-600 hover:bg-red-700"
						onClick={() => toast.info("Quick add coming soon!")}
					>
						<Plus className="h-4 w-4" />
						New
					</Button>
				</div>
			</div>

			{/* Tabs */}
			<Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="w-full">
				<TabsList className="mb-6">
					<TabsTrigger value="overview">Allocation Overview</TabsTrigger>
					<TabsTrigger value="transactions">
						All Transactions ({transactionCount})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="space-y-6">
					{/* Summary Card */}
					<SummaryCard
						summary={summary.summary}
						expectedIncome={summary.allocation.expected_income}
					/>

					{/* Category Cards Grid */}
					{categories.length === 0 ? (
						<div className="text-center py-12 border-2 border-dashed border-neutral-300 rounded-lg">
							<p className="text-neutral-600 mb-4">
								No categories yet. Add your first category to start tracking your
								budget.
							</p>
							<Button
								onClick={handleAddCategory}
								className="gap-2"
							>
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
								className="w-full border-dashed border-2 h-12 gap-2 hover:bg-neutral-50"
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
	);
}
