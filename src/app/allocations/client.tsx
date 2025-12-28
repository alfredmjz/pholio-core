"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, WifiOff, Loader2, Settings, Download, FileText } from "lucide-react";
import { MonthSelector } from "./components/MonthSelector";
import { AddCategoryDialog } from "./components/AddCategoryDialog";
import { BudgetSummaryCards } from "./components/BudgetSummaryCards";
import { CategoryPerformance } from "./components/CategoryPerformance";
import { AllocationDonutChart } from "./components/AllocationDonutChart";
import { TransactionLedger } from "./components/TransactionLedger";
import { AddTransactionButton } from "./components/AddTransactionButton";
import { ImportTemplateDialog } from "./components/ImportTemplateDialog";
import { ExportDialog } from "./components/ExportDialog";
import type { TransactionType } from "./components/TransactionTypeIcon";
import { useAllocationSync } from "@/hooks/useAllocationSync";
import {
	createCategory,
	getOrCreateAllocation,
	importPreviousMonthCategories,
	applyTemplateToAllocation,
} from "./actions";
import { toast } from "sonner";
import { AllocationProvider } from "./context/AllocationContext";
import type { MonthYear, AllocationSummary, Transaction, ViewMode } from "./types";
import type { AccountWithType } from "@/app/balancesheet/types";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import type { AllocationNewMonthDefault } from "@/app/settings/actions";

interface AllocationClientProps {
	initialYear: number;
	initialMonth: number;
	initialSummary: AllocationSummary | null;
	initialTransactions: Transaction[];
	initialAccounts: AccountWithType[];
	previousMonthData?: {
		categoryCount: number;
		totalBudget: number;
		hasData: boolean;
	} | null;
	userSettings?: {
		newMonthDefault: AllocationNewMonthDefault;
	};
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function AllocationClient({
	initialYear,
	initialMonth,
	initialSummary,
	initialTransactions,
	initialAccounts,
	previousMonthData,
	userSettings,
}: AllocationClientProps) {
	const router = useRouter();

	const [currentMonth, setCurrentMonth] = useState<MonthYear>({
		year: initialYear,
		month: initialMonth,
	});
	const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [typeFilter, setTypeFilter] = useState<TransactionType | null>(null);

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
		initialSummary?.allocation.id || "",
		currentMonth.year,
		currentMonth.month,
		initialSummary,
		initialTransactions
	);

	// Handle new/empty months - apply user settings
	useEffect(() => {
		// Only act if we have no summary (truly empty month)
		if (!summary && !templateDialogOpen) {
			// Delay to avoid flash on initial load
			const timer = setTimeout(() => {
				const defaultBehavior = userSettings?.newMonthDefault || "dialog";

				switch (defaultBehavior) {
					case "dialog":
						setTemplateDialogOpen(true);
						break;
					case "import_previous":
						// Auto-import with income prompt
						// For now, show dialog - user can set income there
						setTemplateDialogOpen(true);
						break;
					case "template":
						// Auto-apply template with income prompt
						// For now, show dialog - user can set income there
						setTemplateDialogOpen(true);
						break;
					case "fresh":
						// Auto-create empty allocation
						// For now, show dialog - user can set income there
						setTemplateDialogOpen(true);
						break;
					default:
						setTemplateDialogOpen(true);
				}
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [summary, currentMonth, userSettings?.newMonthDefault]);

	// Handle month changes by navigating to new URL
	const handleMonthChange = (newMonth: MonthYear) => {
		setCurrentMonth(newMonth);
		setTypeFilter(null); // Reset filters on month change
		router.push(`/allocations?year=${newMonth.year}&month=${newMonth.month}`);
	};

	const handleAddCategory = () => {
		setAddCategoryDialogOpen(true);
	};

	const handleAddCategorySubmit = async (name: string, budgetCap: number) => {
		if (!summary) return;

		const previousSummary = summary;
		const tempId = optimisticallyAddCategory(name, budgetCap);

		const newCategory = await createCategory(summary.allocation.id, name, budgetCap);

		if (newCategory) {
			toast.success("Category created");
		} else {
			toast.error("Failed to create category");
			rollback(previousSummary);
		}
	};

	// Template dialog handlers
	const handleImportPrevious = async (expectedIncome: number) => {
		const allocation = await importPreviousMonthCategories(currentMonth.year, currentMonth.month, expectedIncome);
		if (allocation) {
			toast.success("Categories imported from previous month!");
			router.refresh();
		} else {
			toast.error("Failed to import categories");
		}
		setTemplateDialogOpen(false);
	};

	const handleUseTemplate = async (templateId: string, expectedIncome: number) => {
		// First create the allocation
		const allocation = await getOrCreateAllocation(currentMonth.year, currentMonth.month, expectedIncome);
		if (!allocation) {
			toast.error("Failed to create budget");
			setTemplateDialogOpen(false);
			return;
		}

		// Then apply the template
		const success = await applyTemplateToAllocation(templateId, allocation.id);
		if (success) {
			toast.success("Template applied!");
			router.refresh();
		} else {
			toast.error("Failed to apply template");
		}
		setTemplateDialogOpen(false);
	};

	const handleStartFresh = async (expectedIncome: number) => {
		const allocation = await getOrCreateAllocation(currentMonth.year, currentMonth.month, expectedIncome);
		if (allocation) {
			toast.success("Budget created!");
			router.refresh();
		} else {
			toast.error("Failed to create budget");
		}
		setTemplateDialogOpen(false);
	};

	// Get previous month info for template dialog
	const getPreviousMonth = () => {
		const prevMonth = currentMonth.month === 1 ? 12 : currentMonth.month - 1;
		const prevYear = currentMonth.month === 1 ? currentMonth.year - 1 : currentMonth.year;
		return {
			name: MONTH_NAMES[prevMonth - 1],
			year: prevYear,
			categoryCount: previousMonthData?.categoryCount || 0,
			totalBudget: previousMonthData?.totalBudget || 0,
		};
	};

	// Error/Empty state
	if (!summary) {
		return (
			<AllocationProvider
				value={{
					optimisticallyUpdateBudget,
					optimisticallyUpdateName,
					optimisticallyDeleteCategory,
					rollback,
				}}
			>
				<PageShell>
					{/* Header */}
					<PageHeader isSticky={true}>
						<div className="flex items-center justify-between">
							<MonthSelector currentMonth={currentMonth} onMonthChange={handleMonthChange} />
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" className="gap-2">
									<Settings className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</PageHeader>

					{/* Empty State */}
					<Card className="p-12 text-center">
						<div className="max-w-md mx-auto">
							<div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
								<FileText className="h-10 w-10 text-primary" />
							</div>
							<h2 className="text-2xl font-bold text-primary mb-2">
								No Budget for {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
							</h2>
							<p className="text-primary mb-6">Set up your budget for this month to start tracking your spending.</p>
							<Button onClick={() => setTemplateDialogOpen(true)} className="gap-2">
								<Plus className="h-4 w-4" />
								Set Up Budget
							</Button>
						</div>
					</Card>

					<ImportTemplateDialog
						open={templateDialogOpen}
						onOpenChange={setTemplateDialogOpen}
						monthName={MONTH_NAMES[currentMonth.month - 1]}
						year={currentMonth.year}
						previousMonth={getPreviousMonth()}
						templates={[]}
						onImportPrevious={handleImportPrevious}
						onUseTemplate={handleUseTemplate}
						onStartFresh={handleStartFresh}
					/>
				</PageShell>
			</AllocationProvider>
		);
	}

	const categories = summary.categories || [];

	return (
		<AllocationProvider
			value={{
				optimisticallyUpdateBudget,
				optimisticallyUpdateName,
				optimisticallyDeleteCategory,
				rollback,
			}}
		>
			<PageShell>
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
				<PageHeader isSticky={true}>
					<div className="flex items-center justify-between">
						<MonthSelector currentMonth={currentMonth} onMonthChange={handleMonthChange} />

						<div className="flex items-center gap-2">
							<Button
								className="gap-2 bg-primary hover:bg-primary/90 text-background"
								onClick={() => setExportDialogOpen(true)}
							>
								<Download className="h-4 w-4" />
								Export
							</Button>
							<Button variant="outline" size="icon" onClick={() => toast.info("Settings coming soon!")}>
								<Settings className="h-4 w-4" />
							</Button>
							<AddTransactionButton
								categories={categories}
								accounts={initialAccounts}
								onSuccess={() => router.refresh()}
							/>
						</div>
					</div>
				</PageHeader>

				{/* Main Content */}
				<PageContent>
					{/* Top Row: Left (Summary Cards + Category Performance) | Right (Allocation Donut) */}
					<div className="flex flex-col lg:flex-row gap-6">
						{/* Left Column: Summary Cards + Category Performance - 3/4 width */}
						<div className="flex-1 lg:flex-[3] flex flex-col gap-6">
							{/* Budget Summary Cards */}
							<BudgetSummaryCards
								expectedIncome={summary.allocation.expected_income}
								totalBudgetAllocated={summary.summary.total_budget_caps}
								totalSpent={summary.summary.total_actual_spend}
							/>

							{/* Category Performance */}
							<CategoryPerformance categories={categories} onAddCategory={handleAddCategory} className="flex-1" />
						</div>

						{/* Right Column: Allocation Donut Chart - 1/4 width, full height */}
						<div className="lg:flex-[1] flex">
							<AllocationDonutChart categories={categories} className="flex-1" />
						</div>
					</div>

					{/* Transaction Ledger - Full Width */}
					<TransactionLedger
						transactions={transactions}
						categories={categories}
						accounts={initialAccounts}
						externalTypeFilter={typeFilter}
						onClearExternalFilter={() => setTypeFilter(null)}
						onTransactionSuccess={() => router.refresh()}
					/>
				</PageContent>

				{/* Dialogs */}
				<AddCategoryDialog
					open={addCategoryDialogOpen}
					onOpenChange={setAddCategoryDialogOpen}
					onSubmit={handleAddCategorySubmit}
					unallocatedFunds={summary.summary.unallocated_funds}
				/>

				<ImportTemplateDialog
					open={templateDialogOpen}
					onOpenChange={setTemplateDialogOpen}
					monthName={MONTH_NAMES[currentMonth.month - 1]}
					year={currentMonth.year}
					previousMonth={getPreviousMonth()}
					templates={[]}
					onImportPrevious={handleImportPrevious}
					onUseTemplate={handleUseTemplate}
					onStartFresh={handleStartFresh}
				/>

				<ExportDialog
					open={exportDialogOpen}
					onOpenChange={setExportDialogOpen}
					currentYear={currentMonth.year}
					currentMonth={currentMonth.month}
				/>
			</PageShell>
		</AllocationProvider>
	);
}
