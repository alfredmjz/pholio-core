"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sameData, useAllocationSync } from "@/hooks/useAllocationSync";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { getAccountsForSelector } from "@/lib/actions/unified-transaction-actions";
import { getAllocationContributions } from "@/lib/actions/contribution-actions";
import {
	createCategory,
	getOrCreateAllocation,
	importPreviousMonthCategories,
	applyTemplateToAllocation,
	createTemplateFromAllocation,
} from "./actions";
import { AllocationProvider } from "./context/AllocationContext";
import { AllocationsEmptyView } from "./components/AllocationsEmptyView";
import { AllocationsDashboardView } from "./components/AllocationsDashboardView";
import { ImportTemplateDialog } from "./components/ImportTemplateDialog";
import { SaveTemplateDialog } from "./components/SaveTemplateDialog";

import type { TransactionType } from "./components/TransactionTypeIcon";
import type { MonthYear, AllocationSummary, Transaction, IncomeVerificationResult } from "./types";
import type { AccountWithType, RegisteredPlan } from "@/app/accounts/types";
import type { AllocationNewMonthDefault } from "@/app/settings/actions";
import type { AllocationContributions } from "@/lib/types/contribution";
import { useFormatSettings } from "@/components/providers/format-provider";

interface AllocationClientProps {
	initialYear: number;
	initialMonth: number;
	initialSummary: AllocationSummary | null;
	initialTransactions: Transaction[];
	initialAccounts: AccountWithType[];
	initialContributions: AllocationContributions;
	previousMonthData?: {
		categoryCount: number;
		totalBudget: number;
		hasData: boolean;
	} | null;
	incomeVerification: IncomeVerificationResult;
	userSettings?: {
		newMonthDefault: AllocationNewMonthDefault;
	};
	templates: Array<{
		id: string;
		name: string;
		description?: string;
		categoryCount: number;
		totalBudget: number;
	}>;
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
	initialContributions,
	previousMonthData,
	incomeVerification,
	userSettings,
	templates,
}: AllocationClientProps) {
	useFormatSettings();
	const router = useRouter();

	// Accounts and contributions refresh with the page's single catch-up refetch in useAllocationSync.
	const { data: accounts, setData: setAccounts } = useServerSyncedData<AccountWithType[]>(
		initialAccounts,
		() => getAccountsForSelector(),
		{ refreshOnFocus: false }
	);

	const [currentMonth, setCurrentMonth] = useState<MonthYear>({
		year: initialYear,
		month: initialMonth,
	});
	const {
		data: contributions,
		setData: setContributions,
		refresh: refreshContributions,
	} = useServerSyncedData<AllocationContributions>(
		initialContributions,
		() => getAllocationContributions(currentMonth.year, currentMonth.month),
		{ refreshOnFocus: false }
	);
	const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
	const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
	const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
	const [isSavingTemplate, setIsSavingTemplate] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [typeFilter, setTypeFilter] = useState<TransactionType | null>(null);
	// The header shows the new month at once; its data arrives with the navigation.
	const [isChangingMonth, startMonthChange] = useTransition();

	const { summary, transactions, isRefetching, optimisticallyReorderCategories, rollback, saveCategoryOrder } =
		useAllocationSync(
			initialSummary?.allocation.id || "",
			currentMonth.year,
			currentMonth.month,
			initialSummary,
			initialTransactions,
			(fresh) => {
				setAccounts((current) => (sameData(current, fresh.accounts) ? current : fresh.accounts));
				setContributions((current) => (sameData(current, fresh.contributions) ? current : fresh.contributions));
			}
		);

	useEffect(() => {
		// Only act if we have no summary (truly empty month)
		if (!summary && !templateDialogOpen && !isChangingMonth) {
			// Delay to avoid flash on initial load
			const timer = setTimeout(() => {
				// All default behaviors currently open the template dialog
				setTemplateDialogOpen(true);
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [summary, currentMonth, userSettings?.newMonthDefault, isChangingMonth]);

	const handleMonthChange = (newMonth: MonthYear) => {
		setCurrentMonth(newMonth);
		setTypeFilter(null); // Reset filters on month change
		startMonthChange(() => router.push(`/allocations?year=${newMonth.year}&month=${newMonth.month}`));
	};

	const handleAddCategorySubmit = async (
		name: string,
		budgetCap: number,
		color?: string,
		contributionPlan: RegisteredPlan | null = null
	) => {
		if (!summary) return;

		const previousSummary = summary;
		const newCategory = await createCategory(
			summary.allocation.id,
			name,
			budgetCap,
			false,
			undefined,
			color,
			contributionPlan
		);

		if (newCategory) {
			toast.success("Category created");
			if (contributionPlan) void refreshContributions();
		} else {
			toast.error("Creation Failed", {
				description: `Failed to create category "${name}". Please try again.`,
			});
			rollback(previousSummary);
		}
	};

	const handleImportPrevious = async (expectedIncome: number) => {
		const allocation = await importPreviousMonthCategories(currentMonth.year, currentMonth.month, expectedIncome);
		if (allocation) {
			toast.success("Categories imported from previous month!");
			router.refresh();
		} else {
			toast.error("Import Failed", {
				description: "Could not import categories from the previous month.",
			});
		}
		setTemplateDialogOpen(false);
	};

	const handleUseTemplate = async (templateId: string, expectedIncome: number) => {
		const allocation = await getOrCreateAllocation(currentMonth.year, currentMonth.month, expectedIncome);
		if (!allocation) {
			toast.error("Setup Failed", {
				description: "Failed to initialize the budget for this month.",
			});
			setTemplateDialogOpen(false);
			return;
		}

		const success = await applyTemplateToAllocation(templateId, allocation.id);
		if (success) {
			toast.success("Template applied!");
			router.refresh();
		} else {
			toast.error("Template Error", {
				description: "Failed to apply the selected template categories.",
			});
		}
		setTemplateDialogOpen(false);
	};

	const handleStartFresh = async (expectedIncome: number) => {
		const allocation = await getOrCreateAllocation(currentMonth.year, currentMonth.month, expectedIncome);
		if (allocation) {
			toast.success("Budget created!");
			router.refresh();
		} else {
			toast.error("Setup Failed", {
				description: "Failed to initialize the budget for this month.",
			});
		}
		setTemplateDialogOpen(false);
	};

	const handleSaveTemplate = async (name: string, description: string) => {
		if (!summary) return;

		setIsSavingTemplate(true);
		try {
			const template = await createTemplateFromAllocation(summary.allocation.id, name, description);
			if (template) {
				toast.success("Template saved!");
				setSaveTemplateDialogOpen(false);
				router.refresh();
			} else {
				toast.error("Save Failed", {
					description: "Failed to save the template.",
				});
			}
		} finally {
			setIsSavingTemplate(false);
		}
	};

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

	const monthName = MONTH_NAMES[currentMonth.month - 1];

	if (!summary) {
		return (
			<AllocationProvider
				value={{
					optimisticallyReorderCategories,
					rollback,
					saveCategoryOrder,
				}}
			>
				<AllocationsEmptyView
					currentMonth={currentMonth}
					isChangingMonth={isChangingMonth}
					onMonthChange={handleMonthChange}
					onSetupBudget={() => setTemplateDialogOpen(true)}
					onExport={() => setExportDialogOpen(true)}
					categories={[]}
					accounts={accounts}
					onTransactionSuccess={() => router.refresh()}
					monthName={monthName}
					exportDialogOpen={exportDialogOpen}
					setExportDialogOpen={setExportDialogOpen}
				/>

				<ImportTemplateDialog
					open={templateDialogOpen}
					onOpenChange={setTemplateDialogOpen}
					monthName={monthName}
					year={currentMonth.year}
					previousMonth={getPreviousMonth()}
					templates={templates}
					onImportPrevious={handleImportPrevious}
					onUseTemplate={handleUseTemplate}
					onStartFresh={handleStartFresh}
				/>
			</AllocationProvider>
		);
	}

	const categories = summary.categories || [];

	return (
		<AllocationProvider
			value={{
				optimisticallyReorderCategories,
				rollback,
				saveCategoryOrder,
			}}
		>
			<AllocationsDashboardView
				isRefetching={isRefetching}
				isChangingMonth={isChangingMonth}
				currentMonth={currentMonth}
				summary={summary}
				categories={categories}
				transactions={transactions}
				accounts={accounts}
				contributions={contributions}
				onContributionsChanged={() => void refreshContributions()}
				typeFilter={typeFilter}
				onMonthChange={handleMonthChange}
				onExport={() => setExportDialogOpen(true)}
				onTransactionSuccess={() => router.refresh()}
				onSetTypeFilter={setTypeFilter}
				addCategoryDialogOpen={addCategoryDialogOpen}
				setAddCategoryDialogOpen={setAddCategoryDialogOpen}
				handleAddCategorySubmit={handleAddCategorySubmit}
				templateDialogOpen={templateDialogOpen}
				setTemplateDialogOpen={setTemplateDialogOpen}
				monthName={monthName}
				previousMonthData={getPreviousMonth()}
				incomeVerification={incomeVerification}
				onImportPrevious={handleImportPrevious}
				onUseTemplate={handleUseTemplate}
				onStartFresh={handleStartFresh}
				templates={templates}
				exportDialogOpen={exportDialogOpen}
				setExportDialogOpen={setExportDialogOpen}
				setSaveTemplateDialogOpen={setSaveTemplateDialogOpen}
			/>

			{summary && (
				<SaveTemplateDialog
					open={saveTemplateDialogOpen}
					onOpenChange={setSaveTemplateDialogOpen}
					onSave={handleSaveTemplate}
					isSaving={isSavingTemplate}
				/>
			)}
		</AllocationProvider>
	);
}
