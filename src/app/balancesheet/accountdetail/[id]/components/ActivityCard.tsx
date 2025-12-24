"use client";

import { ArrowUpRight, ArrowDownLeft, DollarSign, RefreshCw, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AccountTransaction } from "../../../types";

interface ActivityCardProps {
	transactions: AccountTransaction[];
	isLoading: boolean;
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
	onRecordTransaction: () => void;
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
			return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
		default:
			return <DollarSign className="h-4 w-4 text-muted-foreground" />;
	}
};

const formatTime = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

const formatDate = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
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

export function ActivityCard({
	transactions,
	isLoading,
	accountClass,
	formatCurrency,
	onRecordTransaction,
}: ActivityCardProps) {
	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-base font-semibold">Activity</h3>
					<p className="text-sm text-muted-foreground">Recent account transactions and updates</p>
				</div>
				<Button size="sm" onClick={onRecordTransaction}>
					Record Transaction
				</Button>
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
							<Plus className="h-5 w-5 text-muted-foreground" />
						</div>
						<p className="font-medium">No transactions yet</p>
						<p className="text-sm text-muted-foreground">Record your first transaction to get started</p>
					</div>
				) : (
					transactions.slice(0, 5).map((txn) => (
						<div key={txn.id} className="flex items-center gap-4 py-4 border-b border-border last:border-0">
							{/* Time */}
							<span className="text-xs text-muted-foreground w-16 shrink-0">{formatTime(txn.transaction_date)}</span>

							{/* Icon */}
							<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
								{getTransactionIcon(txn.transaction_type)}
							</div>

							{/* Title & Description */}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">{getTransactionTitle(txn.transaction_type)}</p>
								{txn.description && <p className="text-xs text-muted-foreground truncate">{txn.description}</p>}
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
								<span className="text-xs text-muted-foreground">{formatDate(txn.transaction_date)}</span>
							</div>
						</div>
					))
				)}
			</div>
		</Card>
	);
}
