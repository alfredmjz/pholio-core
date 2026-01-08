"use client";

import { Badge } from "@/components/ui/badge";
import { WifiOff, Loader2 } from "lucide-react";
import { AllocationsHeader } from "./AllocationsHeader";
import { BudgetSummaryCards } from "./BudgetSummaryCards";
import { CategoryPerformance } from "./CategoryPerformance";
import { AllocationDonutChart } from "./AllocationDonutChart";
import { TransactionLedger } from "./TransactionLedger";
import { AddCategoryDialog } from "./AddCategoryDialog";
import { ImportTemplateDialog } from "./ImportTemplateDialog";
import { ExportDialog } from "./ExportDialog";
import { PageShell, PageContent } from "@/components/layout/page-shell";

import type { MonthYear, AllocationSummary, AllocationCategory, Transaction } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { TransactionType } from "./TransactionTypeIcon";

interface AllocationsDashboardViewProps {
	// Status
	isConnected: boolean;
	isRefetching: boolean;

	// Data
	currentMonth: MonthYear;
	summary: AllocationSummary;
	categories: AllocationCategory[];
	transactions: Transaction[];
	accounts: AccountWithType[];

	// State
	typeFilter: TransactionType | null;

	// Handlers
	onMonthChange: (month: MonthYear) => void;
	onExport: () => void;
	onTransactionSuccess: () => void;
	onSetTypeFilter: (type: TransactionType | null) => void;

	// Dialog Handlers & State
	addCategoryDialogOpen: boolean;
	setAddCategoryDialogOpen: (open: boolean) => void;
	handleAddCategorySubmit: (name: string, budgetCap: number) => Promise<void>;

	templateDialogOpen: boolean;
	setTemplateDialogOpen: (open: boolean) => void;
	// Template handlers
	monthName: string;
	previousMonthData: any; // Type as needed
	onImportPrevious: (income: number) => Promise<void>;
	onUseTemplate: (id: string, income: number) => Promise<void>;
	onStartFresh: (income: number) => Promise<void>;

	exportDialogOpen: boolean;
	setExportDialogOpen: (open: boolean) => void;
}

export function AllocationsDashboardView({
	isConnected,
	isRefetching,
	currentMonth,
	summary,
	categories,
	transactions,
	accounts,
	typeFilter,
	onMonthChange,
	onExport,
	onTransactionSuccess,
	onSetTypeFilter,
	addCategoryDialogOpen,
	setAddCategoryDialogOpen,
	handleAddCategorySubmit,
	templateDialogOpen,
	setTemplateDialogOpen,
	monthName,
	previousMonthData,
	onImportPrevious,
	onUseTemplate,
	onStartFresh,
	exportDialogOpen,
	setExportDialogOpen,
}: AllocationsDashboardViewProps) {
	return (
		<PageShell>
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

			<AllocationsHeader
				currentMonth={currentMonth}
				onMonthChange={onMonthChange}
				onExport={onExport}
				categories={categories}
				accounts={accounts}
				onTransactionSuccess={onTransactionSuccess}
			/>

			<PageContent>
				<div className="flex flex-col lg:flex-row gap-6">
					<div className="flex-1 lg:flex-[3] flex flex-col gap-6">
						<BudgetSummaryCards
							expectedIncome={summary.allocation.expected_income}
							totalBudgetAllocated={summary.summary.total_budget_caps}
							totalSpent={summary.summary.total_actual_spend}
						/>

						<CategoryPerformance
							categories={categories}
							onAddCategory={() => setAddCategoryDialogOpen(true)}
							className="flex-1"
						/>
					</div>

					<div className="lg:flex-[1] flex">
						<AllocationDonutChart categories={categories} className="flex-1" />
					</div>
				</div>

				<TransactionLedger
					transactions={transactions}
					categories={categories}
					accounts={accounts}
					externalTypeFilter={typeFilter}
					onClearExternalFilter={() => onSetTypeFilter(null)}
					onTransactionSuccess={onTransactionSuccess}
				/>
			</PageContent>

			<AddCategoryDialog
				open={addCategoryDialogOpen}
				onOpenChange={setAddCategoryDialogOpen}
				onSubmit={handleAddCategorySubmit}
				unallocatedFunds={summary.summary.unallocated_funds}
			/>

			<ImportTemplateDialog
				open={templateDialogOpen}
				onOpenChange={setTemplateDialogOpen}
				monthName={monthName}
				year={currentMonth.year}
				previousMonth={previousMonthData}
				templates={[]}
				onImportPrevious={onImportPrevious}
				onUseTemplate={onUseTemplate}
				onStartFresh={onStartFresh}
			/>

			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				currentYear={currentMonth.year}
				currentMonth={currentMonth.month}
			/>
		</PageShell>
	);
}
