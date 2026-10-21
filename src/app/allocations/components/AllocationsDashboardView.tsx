"use client";

import { Badge } from "@/components/ui/badge";
import { WifiOff, Loader2 } from "lucide-react";
import { AllocationsHeader } from "./AllocationsHeader";
import { BudgetSummaryCards } from "./BudgetSummaryCards";
import { CategoryPerformance } from "./CategoryPerformance";
import { SpendingAllocation } from "./SpendingAllocation";
import { TransactionLedger } from "./TransactionLedger";
import { AddCategoryDialog } from "./AddCategoryDialog";
import { ImportTemplateDialog } from "./ImportTemplateDialog";
import { ExportDialog } from "./ExportDialog";
import { PageShell, PageContent } from "@/components/layout/page-shell";

import type {
	MonthYear,
	AllocationSummary,
	AllocationCategory,
	Transaction,
	IncomeVerificationResult,
} from "@/app/allocations/types";
import type { AccountWithType, RegisteredPlan } from "@/app/balancesheet/types";
import type { AllocationContributions } from "@/lib/types/contribution";
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
	contributions: AllocationContributions;
	onContributionsChanged: () => void;

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
	handleAddCategorySubmit: (
		name: string,
		budgetCap: number,
		color?: string,
		contributionPlan?: RegisteredPlan | null
	) => Promise<void>;

	templateDialogOpen: boolean;
	setTemplateDialogOpen: (open: boolean) => void;
	monthName: string;
	previousMonthData: { name: string; year: number; categoryCount: number; totalBudget: number } | null;
	incomeVerification: IncomeVerificationResult;
	onImportPrevious: (income: number) => Promise<void>;
	onUseTemplate: (id: string, income: number) => Promise<void>;
	onStartFresh: (income: number) => Promise<void>;
	templates: Array<{
		id: string;
		name: string;
		description?: string;
		categoryCount: number;
		totalBudget: number;
	}>;

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
	contributions,
	onContributionsChanged,
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
	incomeVerification,
	onImportPrevious,
	onUseTemplate,
	onStartFresh,
	templates,
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
				onImportTemplate={() => setTemplateDialogOpen(true)}
			/>

			<PageContent>
				<div className="flex flex-col gap-6">
					<BudgetSummaryCards
						expectedIncome={summary.allocation.expected_income}
						totalBudgetAllocated={summary.summary.total_budget_caps}
						totalSpent={summary.summary.total_actual_spend}
						incomeVerification={incomeVerification}
						allocationId={summary.allocation.id}
					/>

					<SpendingAllocation categories={categories} />

					<CategoryPerformance
						categories={categories}
						onAddCategory={() => setAddCategoryDialogOpen(true)}
						usedColors={usedColors}
						usedNames={usedNames}
						contributions={contributions}
						year={currentMonth.year}
						onContributionPlanChanged={onContributionsChanged}
					/>
				</div>

				<TransactionLedger
					transactions={transactions}
					categories={categories}
					accounts={accounts}
					externalTypeFilter={typeFilter}
					onClearExternalFilter={() => onSetTypeFilter(null)}
					onTransactionSuccess={onTransactionSuccess}
					currentMonth={currentMonth}
				/>
			</PageContent>

			<AddCategoryDialog
				open={addCategoryDialogOpen}
				onOpenChange={setAddCategoryDialogOpen}
				onSubmit={handleAddCategorySubmit}
				unallocatedFunds={summary.summary.unallocated_funds}
				usedColors={usedColors}
				usedNames={usedNames}
				contributionPools={contributions.pools}
				linkedPlans={Object.values(contributions.categoryPlans)}
				year={currentMonth.year}
			/>

			<ImportTemplateDialog
				open={templateDialogOpen}
				onOpenChange={setTemplateDialogOpen}
				monthName={monthName}
				year={currentMonth.year}
				previousMonth={previousMonthData || undefined}
				templates={templates}
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
