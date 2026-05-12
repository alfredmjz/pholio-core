"use client";

import { Button } from "@/components/ui/button";
import { Settings, Download, FolderPlus, FolderInput } from "lucide-react";
import { MonthSelector } from "@/components/month-selector";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
	onSaveTemplate: () => void;
	onImportTemplate?: () => void;
}

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
		<PageHeader isSticky={true}>
			<div className="flex items-center justify-between">
				<MonthSelector currentMonth={currentMonth} onMonthChange={onMonthChange} />

				<div className="flex items-center gap-2">
					<Button className="gap-2 bg-primary hover:bg-primary/90 text-background" onClick={onExport}>
						<Download className="h-4 w-4" />
						Export
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon">
								<Settings className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{onImportTemplate && (
								<DropdownMenuItem onClick={onImportTemplate}>
									<FolderInput className="mr-2 h-4 w-4" />
									Import Template
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={onSaveTemplate}>
								<FolderPlus className="mr-2 h-4 w-4" />
								Save as Template
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
		</PageHeader>
	);
}
