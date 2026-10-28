"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { AllocationsHeader } from "./AllocationsHeader";
import { BudgetPlanCard } from "./budget-plan-card";
import { CategoryList } from "./category-list";
import { TransactionLedger } from "./TransactionLedger";
import { AddCategoryDialog } from "./AddCategoryDialog";
import { ImportTemplateDialog } from "./ImportTemplateDialog";
import { ExportDialog } from "./ExportDialog";
import { SurfacePage } from "@/components/layout/surface-page";
import { AllocationsContentSkeleton } from "./allocations-loading-skeleton";

import type {
	MonthYear,
	AllocationSummary,
	AllocationCategory,
	Transaction,
	IncomeVerificationResult,
} from "@/app/allocations/types";
import type { AccountWithType, RegisteredPlan } from "@/app/accounts/types";
import type { AllocationContributions } from "@/lib/types/contribution";
import type { TransactionType } from "./TransactionTypeIcon";

interface AllocationsDashboardViewProps {
	// Status
	isRefetching: boolean;
	/** A new month's data is on its way; the page below the header shows a skeleton until it lands. */
	isChangingMonth?: boolean;

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

	setSaveTemplateDialogOpen: (open: boolean) => void;
}

export function AllocationsDashboardView({
	isRefetching,
	isChangingMonth = false,
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
	setSaveTemplateDialogOpen,
}: AllocationsDashboardViewProps) {
	const usedColors = categories.map((c) => c.color).filter(Boolean) as string[];
	const usedNames = categories.map((c) => c.name);

	return (
		<SurfacePage className="gap-8 md:gap-10">
			{isRefetching && (
				<div className="fixed bottom-24 right-4 z-40 lg:bottom-6">
					<Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 shadow-raised">
						<Loader2 className="h-3 w-3 animate-spin" />
						Syncing
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

			{isChangingMonth ? (
				<AllocationsContentSkeleton />
			) : (
				<>
					<BudgetPlanCard
						expectedIncome={summary.allocation.expected_income}
						categories={categories}
						contributions={contributions}
						incomeVerification={incomeVerification}
						allocationId={summary.allocation.id}
					/>

					<CategoryList
						categories={categories}
						onAddCategory={() => setAddCategoryDialogOpen(true)}
						usedColors={usedColors}
						usedNames={usedNames}
						contributions={contributions}
						year={currentMonth.year}
						onContributionPlanChanged={onContributionsChanged}
					/>

					<TransactionLedger
						transactions={transactions}
						categories={categories}
						accounts={accounts}
						externalTypeFilter={typeFilter}
						onClearExternalFilter={() => onSetTypeFilter(null)}
						onTransactionSuccess={onTransactionSuccess}
						currentMonth={currentMonth}
					/>
				</>
			)}

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
		</SurfacePage>
	);
}
