"use client";

import { cn } from "@/lib/utils";
import type { Transaction, AllocationCategory } from "../types";
import { inferTransactionType } from "./TransactionTypeIcon";
import { TransactionTypeIcon } from "./TransactionTypeIcon";
import { getCategoryColor } from "./CategoryPerformance";

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
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide w-[140px]">
							Name
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide w-[120px]">
							Category
						</th>
						<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide w-[140px]">
							Type
						</th>
						<th className="px-4 py-3 text-right text-xs font-semibold text-primary uppercase tracking-wide w-[100px]">
							Amount
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border bg-card">
					{transactions.map((transaction) => {
						const categoryIndex = categories.findIndex((c) => c.id === transaction.category_id);
						const txType = inferTransactionType(transaction);
						const categoryStyle = categoryIndex !== -1 ? getCategoryColor(categoryIndex) : null;

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
									<div className="text-sm font-medium text-primary">{transaction.name}</div>
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
								<td className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wide w-[140px]">
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
