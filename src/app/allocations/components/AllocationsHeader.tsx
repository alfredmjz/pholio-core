"use client";

import { Button } from "@/components/ui/button";
import { Settings, Download } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/month-selector";
import { AddTransactionButton } from "./AddTransactionButton";
import { PageHeader } from "@/components/layout/page-shell";
import type { MonthYear, AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";

interface AllocationsHeaderProps {
	currentMonth: MonthYear;
	onMonthChange: (month: MonthYear) => void;
	onExport: () => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	onTransactionSuccess: () => void;
}

export function AllocationsHeader({
	currentMonth,
	onMonthChange,
	onExport,
	categories,
	accounts,
	onTransactionSuccess,
}: AllocationsHeaderProps) {
	return (
		<PageHeader isSticky={true}>
			<div className="flex items-center justify-between">
				<MonthSelector currentMonth={currentMonth} onMonthChange={onMonthChange} />

				<div className="flex items-center gap-2">
					<Button className="gap-2 bg-primary hover:bg-primary/90 text-background" onClick={onExport}>
						<Download className="h-4 w-4" />
						Export
					</Button>
					<Button variant="outline" size="icon" onClick={() => toast.info("Settings coming soon!")}>
						<Settings className="h-4 w-4" />
					</Button>
					<AddTransactionButton categories={categories} accounts={accounts} onSuccess={onTransactionSuccess} />
				</div>
			</div>
		</PageHeader>
	);
}
