import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AllocationsHeader } from "./AllocationsHeader";
import { SurfacePage } from "@/components/layout/surface-page";
import { ExportDialog } from "./ExportDialog";
import { AllocationsContentSkeleton } from "./allocations-loading-skeleton";
import type { MonthYear, AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/accounts/types";

interface AllocationsEmptyViewProps {
	currentMonth: MonthYear;
	/** A new month's data is on its way; shows a skeleton instead of the set-up prompt. */
	isChangingMonth?: boolean;
	onMonthChange: (month: MonthYear) => void;
	onSetupBudget: () => void;
	// Header props passed through
	onExport: () => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	onTransactionSuccess: () => void;
	monthName: string;

	// Export Dialog State
	exportDialogOpen: boolean;
	setExportDialogOpen: (open: boolean) => void;
}

export function AllocationsEmptyView({
	currentMonth,
	isChangingMonth = false,
	onMonthChange,
	onSetupBudget,
	onExport,
	categories,
	accounts,
	onTransactionSuccess,
	monthName,
	exportDialogOpen,
	setExportDialogOpen,
}: AllocationsEmptyViewProps) {
	return (
		<SurfacePage>
			<AllocationsHeader
				currentMonth={currentMonth}
				onMonthChange={onMonthChange}
				onExport={onExport}
				categories={categories}
				accounts={accounts}
				onTransactionSuccess={onTransactionSuccess}
				onSaveTemplate={() => {}}
			/>

			{isChangingMonth ? (
				<AllocationsContentSkeleton />
			) : (
				<section className="surface-sheet surface-sheet-pad flex flex-col items-start gap-4 py-10 md:py-14">
					<h2 className="type-h2 text-primary">Plan {monthName}</h2>
					<p className="type-body-lg max-w-xl text-muted-foreground">
						Give every dollar of {monthName}&apos;s income a job. Start from last month, a template, or a blank budget.
					</p>
					<Button onClick={onSetupBudget} className="mt-2 h-10 gap-2 rounded-full px-5">
						<Plus className="h-4 w-4" aria-hidden />
						Set up {monthName}&apos;s budget
					</Button>
				</section>
			)}

			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				currentYear={currentMonth.year}
				currentMonth={currentMonth.month}
			/>
		</SurfacePage>
	);
}
