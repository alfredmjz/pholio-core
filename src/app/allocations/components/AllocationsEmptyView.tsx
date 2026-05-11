import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";
import { AllocationsHeader } from "./AllocationsHeader";
import { PageShell } from "@/components/layout/page-shell";
import { ExportDialog } from "./ExportDialog";
import type { MonthYear, AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";

interface AllocationsEmptyViewProps {
	currentMonth: MonthYear;
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
		<PageShell>
			<AllocationsHeader
				currentMonth={currentMonth}
				onMonthChange={onMonthChange}
				onExport={onExport}
				categories={categories}
				accounts={accounts}
				onTransactionSuccess={onTransactionSuccess}
				onSaveTemplate={() => {}}
			/>

			{/* Empty State Card */}
			<Card className="p-12 text-center mt-6">
				<div className="max-w-md mx-auto">
					<div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
						<FileText className="h-10 w-10 text-primary" />
					</div>
					<h2 className="text-2xl font-bold text-primary mb-2">
						No Budget for {monthName} {currentMonth.year}
					</h2>
					<p className="text-primary mb-6">Set up your budget for this month to start tracking your spending.</p>
					<Button onClick={onSetupBudget} className="gap-2">
						<Plus className="h-4 w-4" />
						Set Up Budget
					</Button>
				</div>
			</Card>

			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				currentYear={currentMonth.year}
				currentMonth={currentMonth.month}
			/>
		</PageShell>
	);
}
