"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Ban } from "lucide-react";
import type { Transaction, AllocationCategory } from "../types";
import { inferTransactionType } from "./TransactionTypeIcon";
import { TransactionTypeIcon } from "./TransactionTypeIcon";

interface TransactionTableProps {
	transactions: Transaction[];
	categories: AllocationCategory[];
	onClickTransaction?: (transaction: Transaction) => void;
}

export function TransactionTable({ transactions, categories, onClickTransaction }: TransactionTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full">
				<thead className="bg-muted/50 border-b border-border">
					<tr>
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide w-[100px]">
							Date
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Name</th>
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide">Category</th>
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide w-[180px]">
							Type
						</th>
						<th className="px-4 py-3 text-right text-xs font-semibold text-primary uppercase tracking-wide w-[100px]">
							Amount
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border bg-card">
					{transactions.map((transaction) => {
						const txType = inferTransactionType(transaction);

						return (
							<tr
								key={transaction.id}
								className="hover:bg-muted/30 transition-colors cursor-pointer group"
								onClick={() => onClickTransaction?.(transaction)}
							>
								<td className="px-4 py-3 whitespace-nowrap">
									<span className="text-sm text-primary">
										{new Date(transaction.transaction_date).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}
									</span>
								</td>
								<td className="px-4 py-3">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-sm font-medium text-primary">{transaction.name}</span>
										{transaction.is_recurring_stopped && (
											<Badge
												variant="outline"
												className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 gap-1 px-1.5 py-0"
												title="Recurring has been stopped/paused — this is the last recorded transaction."
											>
												<Ban className="h-2.5 w-2.5" /> Final / Stopped
											</Badge>
										)}
									</div>
									{transaction.notes && (
										<div className="text-xs text-primary truncate max-w-[200px]">{transaction.notes}</div>
									)}
								</td>
								<td className="px-4 py-3">
									{transaction.category_name ? (
										<span className="text-sm text-primary">{transaction.category_name}</span>
									) : (
										<span className="text-sm text-primary">Uncategorized</span>
									)}
								</td>
								<td className="px-4 py-3 text-left">
									<TransactionTypeIcon type={txType} size="sm" showLabel />
								</td>
								<td className="px-4 py-3 text-right whitespace-nowrap">
									<span className={cn("text-sm font-semibold", transaction.amount > 0 ? "text-success" : "text-error")}>
										{transaction.amount > 0 ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
									</span>
								</td>
							</tr>
						);
					})}
					{transactions.length === 0 && (
						<tr>
							<td colSpan={5} className="px-4 py-12 text-center text-primary">
								No transactions for this month
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
