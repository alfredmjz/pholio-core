"use client";

import { Badge } from "@/components/ui/badge";
import { WifiOff, Loader2 } from "lucide-react";
import { AllocationsHeader } from "./AllocationsHeader";
import { BudgetSummaryCards } from "./BudgetSummaryCards";
import { CategoryPerformance } from "./CategoryPerformance";
import { SpendingPace } from "./SpendingPace";
import { SpendingAllocation } from "./SpendingAllocation";
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
	handleAddCategorySubmit: (name: string, budgetCap: number, color?: string) => Promise<void>;

	templateDialogOpen: boolean;
	setTemplateDialogOpen: (open: boolean) => void;
	monthName: string;
	previousMonthData: { name: string; year: number; categoryCount: number; totalBudget: number } | null;
	historicalPace: { hasEnoughData: boolean; dailyAmounts: number[] };
	onImportPrevious: (income: number) => Promise<void>;
	onUseTemplate: (id: string, income: number) => Promise<void>;
	onStartFresh: (income: number) => Promise<void>;

	exportDialogOpen: boolean;
	setExportDialogOpen: (open: boolean) => void;

	saveTemplateDialogOpen: boolean;
	setSaveTemplateDialogOpen: (open: boolean) => void;
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
	historicalPace,
	onImportPrevious,
	onUseTemplate,
	onStartFresh,
	exportDialogOpen,
	setExportDialogOpen,
	saveTemplateDialogOpen,
	setSaveTemplateDialogOpen,
}: AllocationsDashboardViewProps) {
	const usedColors = categories.map((c) => c.color).filter(Boolean) as string[];
	const usedNames = categories.map((c) => c.name);

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
				onSaveTemplate={() => setSaveTemplateDialogOpen(true)}
			/>

			<PageContent>
				<div className="flex flex-col gap-6">
					<div className="flex flex-col lg:flex-row gap-6">
						<div className="w-full lg:w-[60%] flex flex-col gap-6">
							<BudgetSummaryCards
								expectedIncome={summary.allocation.expected_income}
								totalBudgetAllocated={summary.summary.total_budget_caps}
								totalSpent={summary.summary.total_actual_spend}
							/>

							<SpendingAllocation categories={categories} />
						</div>

						<div className="w-full lg:w-[40%] flex flex-col">
							<SpendingPace
								currentMonth={currentMonth}
								transactions={transactions}
								totalBudget={summary.summary.total_budget_caps}
								historicalPace={historicalPace}
								className="flex-1"
							/>
						</div>
					</div>

					<CategoryPerformance
						categories={categories}
						onAddCategory={() => setAddCategoryDialogOpen(true)}
						usedColors={usedColors}
						usedNames={usedNames}
					/>
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
				usedColors={usedColors}
				usedNames={usedNames}
			/>

			<ImportTemplateDialog
				open={templateDialogOpen}
				onOpenChange={setTemplateDialogOpen}
				monthName={monthName}
				year={currentMonth.year}
				previousMonth={previousMonthData || undefined}
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
