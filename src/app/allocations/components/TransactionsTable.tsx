"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Search, ArrowUpDown } from "lucide-react";
import type { Transaction, AllocationCategory } from "../types";

interface TransactionsTableProps {
	transactions: Transaction[];
	categories: AllocationCategory[];
}

type SortField = "name" | "amount" | "date" | "category";
type SortDirection = "asc" | "desc";

export function TransactionsTable({
	transactions,
	categories,
}: TransactionsTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [sortField, setSortField] = useState<SortField>("date");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	// Filter and sort transactions
	const filteredTransactions = useMemo(() => {
		let filtered = transactions;

		// Search filter
		if (searchQuery) {
			filtered = filtered.filter((t) =>
				t.name.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		// Category filter
		if (categoryFilter !== "all") {
			filtered = filtered.filter((t) => t.category_id === categoryFilter);
		}

		// Sort
		filtered.sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "name":
					comparison = a.name.localeCompare(b.name);
					break;
				case "amount":
					comparison = Math.abs(a.amount) - Math.abs(b.amount);
					break;
				case "date":
					comparison =
						new Date(a.transaction_date).getTime() -
						new Date(b.transaction_date).getTime();
					break;
				case "category":
					comparison = (a.category_name || "").localeCompare(
						b.category_name || ""
					);
					break;
			}

			return sortDirection === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [transactions, searchQuery, categoryFilter, sortField, sortDirection]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
	};

	const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
		<button
			onClick={() => toggleSort(field)}
			className="flex items-center gap-1 hover:text-neutral-900 transition-colors"
		>
			{children}
			<ArrowUpDown
				className={`h-3.5 w-3.5 ${
					sortField === field ? "text-blue-600" : "text-neutral-400"
				}`}
			/>
		</button>
	);

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
					<Input
						type="text"
						placeholder="Search transactions..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				<Select value={categoryFilter} onValueChange={setCategoryFilter}>
					<SelectTrigger className="w-48">
						<SelectValue placeholder="All Categories" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Categories</SelectItem>
						{categories.map((cat) => (
							<SelectItem key={cat.id} value={cat.id}>
								{cat.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Table */}
			<div className="border border-neutral-200 rounded-lg overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-neutral-100 border-b border-neutral-200">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
									<SortButton field="name">Name</SortButton>
								</th>
								<th className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">
									<SortButton field="amount">Amount</SortButton>
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
									<SortButton field="category">Category</SortButton>
								</th>
								<th className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 uppercase tracking-wider">
									<SortButton field="date">Date</SortButton>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-neutral-200 bg-white">
							{filteredTransactions.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="px-4 py-12 text-center text-neutral-500"
									>
										{searchQuery || categoryFilter !== "all"
											? "No transactions match your filters"
											: "No transactions for this month"}
									</td>
								</tr>
							) : (
								filteredTransactions.map((transaction) => (
									<tr
										key={transaction.id}
										className="hover:bg-neutral-50 transition-colors"
									>
										<td className="px-4 py-3">
											<div className="text-sm font-medium text-neutral-900">
												{transaction.name}
											</div>
											{transaction.source !== "manual" && (
												<div className="text-xs text-neutral-500 mt-0.5">
													{transaction.source}
												</div>
											)}
										</td>
										<td className="px-4 py-3 text-right">
											<span
												className={`text-sm font-semibold ${
													transaction.amount > 0
														? "text-green-600"
														: "text-red-600"
												}`}
											>
												{transaction.amount > 0 ? "+" : ""}$
												{Math.abs(transaction.amount).toFixed(2)}
											</span>
										</td>
										<td className="px-4 py-3">
											{transaction.category_name ? (
												<Badge
													variant="outline"
													className="bg-neutral-900 text-white border-neutral-900"
												>
													{transaction.category_name}
												</Badge>
											) : (
												<span className="text-xs text-neutral-400">
													Uncategorized
												</span>
											)}
										</td>
										<td className="px-4 py-3 text-right">
											<span className="text-sm text-neutral-600">
												{new Date(transaction.transaction_date).toLocaleDateString(
													"en-US",
													{
														year: "numeric",
														month: "short",
														day: "numeric",
													}
												)}
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Count */}
			{filteredTransactions.length > 0 && (
				<div className="text-xs text-neutral-500 text-right">
					Showing {filteredTransactions.length} of {transactions.length}{" "}
					{transactions.length === 1 ? "transaction" : "transactions"}
				</div>
			)}
		</div>
	);
}
