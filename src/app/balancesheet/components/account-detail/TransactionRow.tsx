"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountTransaction } from "../../types";

interface TransactionRowProps {
	transaction: AccountTransaction;
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
	formatDate: (dateString: string) => string;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
	deposit: "Deposit",
	withdrawal: "Withdrawal",
	payment: "Payment",
	interest: "Interest",
	adjustment: "Adjustment",
	contribution: "Contribution",
	transfer: "Transfer",
};

/**
 * Determines the sign (+/-) for a transaction based on type and account class.
 */
function getTransactionSign(type: string, accountType: string): "+" | "-" {
	if (accountType === "asset") {
		return type === "deposit" || type === "contribution" || type === "interest" ? "+" : "-";
	} else {
		return type === "payment" ? "-" : "+";
	}
}

/**
 * Individual transaction row component.
 */
export function TransactionRow({ transaction, accountClass, formatCurrency, formatDate }: TransactionRowProps) {
	const sign = getTransactionSign(transaction.transaction_type, accountClass || "asset");
	const isPositive = sign === "+";

	return (
		<div className="group flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm transition-all hover:shadow-md hover:border-primary/20">
			<div className="flex items-center gap-4">
				<div
					className={cn(
						"p-2.5 rounded-lg",
						isPositive
							? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
							: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
					)}
				>
					{isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
				</div>
				<div className="flex flex-col gap-0.5">
					<p className="font-medium text-sm">
						{transaction.description ||
							TRANSACTION_TYPE_LABELS[transaction.transaction_type] ||
							transaction.transaction_type}
					</p>
					<p className="text-xs text-primary">{formatDate(transaction.transaction_date)}</p>
				</div>
			</div>

			<div className="text-right flex flex-col gap-1 items-end">
				<div
					className={cn(
						"font-bold",
						isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
					)}
				>
					{sign}
					{formatCurrency(Math.abs(transaction.amount))}
				</div>
				<Badge
					variant="secondary"
					className="text-[10px] h-5 px-1.5 font-normal opacity-0 group-hover:opacity-100 transition-opacity"
				>
					{TRANSACTION_TYPE_LABELS[transaction.transaction_type] || transaction.transaction_type}
				</Badge>
			</div>
		</div>
	);
}

export { TRANSACTION_TYPE_LABELS, getTransactionSign };
