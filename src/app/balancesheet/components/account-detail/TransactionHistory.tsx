"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { AccountTransaction } from "../../types";
import { TransactionRow } from "./TransactionRow";
import { TransactionSkeleton } from "./TransactionSkeleton";

interface TransactionHistoryProps {
	transactions: AccountTransaction[];
	isLoading: boolean;
	accountClass: "asset" | "liability" | undefined;
	onRecordTransaction: () => void;
	formatCurrency: (amount: number) => string;
	formatDate: (dateString: string) => string;
}

/**
 * Transaction history section with list, empty state, and loading skeleton.
 */
export function TransactionHistory({
	transactions,
	isLoading,
	accountClass,
	onRecordTransaction,
	formatCurrency,
	formatDate,
}: TransactionHistoryProps) {
	return (
		<div className="flex-1 flex flex-col">
			<div className="flex items-center justify-between p-6 pb-4">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					Transaction History
					<Badge variant="secondary" className="rounded-full px-2 py-0.5 h-auto text-xs font-normal">
						{transactions.length}
					</Badge>
				</h3>
				<Button size="sm" onClick={onRecordTransaction}>
					<Plus className="h-4 w-4" />
					{accountClass === "asset" ? "Add Deposit" : "Record Payment"}
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-3">
				{isLoading ? (
					<TransactionSkeleton />
				) : transactions.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-xl border-muted-foreground/20 gap-3">
						<div className="p-4 rounded-full bg-muted">
							<Plus className="h-6 w-6 text-muted-foreground" />
						</div>
						<p className="font-medium">No transactions yet</p>
						<p className="text-sm text-muted-foreground">Record your first transaction to get started</p>
					</div>
				) : (
					transactions.map((txn) => (
						<TransactionRow
							key={txn.id}
							transaction={txn}
							accountClass={accountClass}
							formatCurrency={formatCurrency}
							formatDate={formatDate}
						/>
					))
				)}
			</div>
		</div>
	);
}
