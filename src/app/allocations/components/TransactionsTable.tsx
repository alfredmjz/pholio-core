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
import { Search, ArrowUpDown, Plus } from "lucide-react";
import type { Transaction, AllocationCategory } from "../types";

interface TransactionsTableProps {
	transactions: Transaction[];
	categories: AllocationCategory[];
}

type SortField = "name" | "amount" | "date" | "category";
type SortDirection = "asc" | "desc";

// Helper function to generate consistent color for each category based on hash
function getCategoryBadgeColor(categoryName: string): string {
	// Simple hash function to get consistent index from category name
	let hash = 0;
	for (let i = 0; i < categoryName.length; i++) {
		hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
	}

	const colors = [
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
		"bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
		"bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
		"bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
		"bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
	];

	// Use absolute value of hash to get positive index
	const index = Math.abs(hash) % colors.length;
	return colors[index];
}

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
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3 flex-1">
					<div className="relative flex-1 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
						<Input
							type="text"
							placeholder="Search..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9 bg-card border-gray-200"
						/>
					</div>

					<Select value={categoryFilter} onValueChange={setCategoryFilter}>
						<SelectTrigger className="w-48 bg-card border-gray-200">
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

				<Button className="gap-2 bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900">
					<Plus className="h-4 w-4" />
					New
				</Button>
			</div>

			{/* Table */}
			<div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-card">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
									<SortButton field="date">Date</SortButton>
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
									<SortButton field="name">Name</SortButton>
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
									<SortButton field="category">Category</SortButton>
								</th>
								<th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
									<SortButton field="amount">Amount</SortButton>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-card">
							{filteredTransactions.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="px-6 py-12 text-center text-gray-500"
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
										className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap">
											<span className="text-sm text-gray-900 dark:text-gray-100">
												{new Date(transaction.transaction_date).toLocaleDateString(
													"en-US",
													{
														year: "numeric",
														month: "2-digit",
														day: "2-digit",
													}
												)}
											</span>
										</td>
										<td className="px-6 py-4">
											<div className="text-sm font-medium text-gray-900 dark:text-gray-100">
												{transaction.name}
											</div>
										</td>
										<td className="px-6 py-4">
											{transaction.category_name ? (
												<Badge
													variant="secondary"
													className={getCategoryBadgeColor(transaction.category_name)}
												>
													{transaction.category_name}
												</Badge>
											) : (
												<span className="text-xs text-gray-400">
													Uncategorized
												</span>
											)}
										</td>
										<td className="px-6 py-4 text-right whitespace-nowrap">
											<span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
												${Math.abs(transaction.amount).toFixed(2)}
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
				<div className="text-xs text-gray-500 dark:text-gray-400 text-right">
					Showing {filteredTransactions.length} of {transactions.length}{" "}
					{transactions.length === 1 ? "transaction" : "transactions"}
				</div>
			)}
		</div>
	);
}
