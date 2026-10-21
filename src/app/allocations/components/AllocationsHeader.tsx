"use client";

import { Button } from "@/components/ui/button";
import { Download, FolderInput, FolderPlus, MoreHorizontal } from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddTransactionButton } from "./AddTransactionButton";
import type { MonthYear, AllocationCategory } from "@/app/allocations/types";
import type { AccountWithType } from "@/app/balancesheet/types";

interface AllocationsHeaderProps {
	currentMonth: MonthYear;
	onMonthChange: (month: MonthYear) => void;
	onExport: () => void;
	categories: AllocationCategory[];
	accounts: AccountWithType[];
	onTransactionSuccess: () => void;
	onSaveTemplate: () => void;
	onImportTemplate?: () => void;
}

/** Month title and navigation, pinned while the budget scrolls beneath it. */
export function AllocationsHeader({
	currentMonth,
	onMonthChange,
	onExport,
	categories,
	accounts,
	onTransactionSuccess,
	onSaveTemplate,
	onImportTemplate,
}: AllocationsHeaderProps) {
	return (
		<header className="sticky top-0 z-30 -mx-4 -mt-6 bg-background/70 px-4 pb-3 pt-6 backdrop-blur-md md:-mx-8 md:-mt-10 md:px-8 md:pt-10">
			<div className="flex items-start justify-between gap-3 sm:items-center">
				<MonthSelector currentMonth={currentMonth} onMonthChange={onMonthChange} />

				<div className="flex shrink-0 items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="h-10 w-10 rounded-full bg-card/60 backdrop-blur-sm"
								aria-label="More budget actions"
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							{onImportTemplate && (
								<DropdownMenuItem onClick={onImportTemplate}>
									<FolderInput className="mr-2 h-4 w-4" />
									Import a template
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={onSaveTemplate}>
								<FolderPlus className="mr-2 h-4 w-4" />
								Save as template
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={onExport}>
								<Download className="mr-2 h-4 w-4" />
								Export
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<AddTransactionButton
						categories={categories}
						accounts={accounts}
						onSuccess={onTransactionSuccess}
						boundaryMonth={currentMonth}
					/>
				</div>
			</div>
		</header>
	);
}
