"use client";

import { ArrowUpRight, ArrowDownLeft, DollarSign, RefreshCw, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatTime, formatFullDate } from "@/lib/date-utils";
import type { AccountTransaction } from "../../../types";

interface ActivityCardProps {
	transactions: AccountTransaction[];
	isLoading: boolean;
	formatCurrency: (amount: number) => string;
	onTransactionClick?: (transaction: AccountTransaction) => void;
}

const getTransactionIcon = (type: string) => {
	switch (type) {
		case "deposit":
		case "contribution":
			return <ArrowUpRight className="h-4 w-4 text-green-600" />;
		case "withdrawal":
		case "payment":
			return <ArrowDownLeft className="h-4 w-4 text-red-500" />;
		case "interest":
			return <DollarSign className="h-4 w-4 text-blue-500" />;
		case "adjustment":
		case "transfer":
			return <RefreshCw className="h-4 w-4 text-primary" />;
		default:
			return <DollarSign className="h-4 w-4 text-primary" />;
	}
};

const getTransactionTitle = (type: string) => {
	switch (type) {
		case "deposit":
			return "Direct Deposit";
		case "contribution":
			return "Contribution";
		case "withdrawal":
			return "Withdrawal";
		case "payment":
			return "Payment";
		case "interest":
			return "Interest Payment";
		case "adjustment":
			return "Balance Adjustment";
		case "transfer":
			return "Transfer";
		default:
			return "Transaction";
	}
};

export function ActivityCard({ transactions, isLoading, formatCurrency, onTransactionClick }: ActivityCardProps) {
	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-base font-semibold">Activity</h3>
					<p className="text-sm text-primary">Recent account transactions and updates</p>
				</div>
			</div>

			<div className="flex flex-col gap-0">
				{isLoading ? (
					<>
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex items-center gap-4 py-4 border-b border-border last:border-0">
								<Skeleton className="h-4 w-16" />
								<Skeleton className="h-8 w-8 rounded-full" />
								<div className="flex-1 flex flex-col gap-1">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-40" />
								</div>
								<div className="flex flex-col items-end gap-1">
									<Skeleton className="h-4 w-16" />
									<Skeleton className="h-3 w-20" />
								</div>
							</div>
						))}
					</>
				) : transactions.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-border">
						<div className="p-3 rounded-full bg-muted mb-3">
							<Plus className="h-5 w-5 text-primary" />
						</div>
						<p className="font-medium">No transactions yet</p>
						<p className="text-sm text-primary">Record your first transaction to get started</p>
					</div>
				) : (
					transactions.slice(0, 5).map((txn) => (
						<div
							key={txn.id}
							className="flex items-center gap-4 py-4 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors -mx-2 px-2"
							onClick={() => onTransactionClick?.(txn)}
						>
							{/* Icon */}
							<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
								{getTransactionIcon(txn.transaction_type)}
							</div>

							{/* Title & Description */}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">{getTransactionTitle(txn.transaction_type)}</p>
								{txn.description && <p className="text-xs text-primary truncate">{txn.description}</p>}
							</div>

							{/* Amount & Date */}
							<div className="flex flex-col items-end shrink-0">
								<span
									className={cn(
										"text-sm font-medium",
										txn.transaction_type === "withdrawal" || txn.transaction_type === "payment"
											? "text-red-600 dark:text-red-400"
											: "text-green-600 dark:text-green-400"
									)}
								>
									{txn.transaction_type === "withdrawal" || txn.transaction_type === "payment" ? "-" : "+"}
									{formatCurrency(txn.amount)}
								</span>
								<span className="text-xs text-primary">{formatFullDate(txn.transaction_date)}</span>
							</div>
						</div>
					))
				)}
			</div>
		</Card>
	);
}
