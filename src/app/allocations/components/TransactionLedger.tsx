"use client";

import { useState, useMemo } from "react";
import { Search, Filter, X, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AllocationCategory, Transaction } from "../types";
import type { TransactionType } from "./TransactionTypeIcon";
import { inferTransactionType, TRANSACTION_TYPE_CONFIG, TransactionTypeIcon } from "./TransactionTypeIcon";
import { getCategoryColor } from "./CategoryPerformance";
import { AddTransactionButton } from "./AddTransactionButton";
import { TransactionDialog } from "./TransactionDialog";

interface TransactionLedgerProps {
	transactions: Transaction[];
	categories: AllocationCategory[];
	accounts?: import("@/app/balancesheet/types").AccountWithType[];
	externalTypeFilter?: TransactionType | null;
	onClearExternalFilter?: () => void;
	onTransactionSuccess?: () => void;
}

type SortField = "date" | "name" | "amount" | "category" | "type";
type SortDirection = "asc" | "desc";

// Helper removed, using getCategoryColor from CategoryPerformance

export function TransactionLedger({
	transactions,
	categories,
	accounts = [],
	externalTypeFilter,
	onClearExternalFilter,
	onTransactionSuccess,
}: TransactionLedgerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
	const [sortField, setSortField] = useState<SortField>("date");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [showFilters, setShowFilters] = useState(false);

	// Amount range filter (optional enhancement)
	const [minAmount, setMinAmount] = useState<string>("");
	const [maxAmount, setMaxAmount] = useState<string>("");

	// Effective type filter (external takes precedence)
	const effectiveTypeFilter = externalTypeFilter || (typeFilter !== "all" ? typeFilter : null);

	// Dialog State
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

	const handleEditTransaction = (transaction: Transaction) => {
		setSelectedTransaction(transaction);
		setDialogOpen(true);
	};

	// Filter and sort transactions
	const filteredTransactions = useMemo(() => {
		let filtered = transactions;

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.category_name?.toLowerCase().includes(query) ||
					t.notes?.toLowerCase().includes(query)
			);
		}

		// Category filter
		if (categoryFilter !== "all") {
			filtered = filtered.filter((t) => t.category_id === categoryFilter);
		}

		// Type filter
		if (effectiveTypeFilter) {
			filtered = filtered.filter((t) => inferTransactionType(t) === effectiveTypeFilter);
		}

		// Amount range filter
		const min = parseFloat(minAmount);
		const max = parseFloat(maxAmount);
		if (!isNaN(min)) {
			filtered = filtered.filter((t) => Math.abs(t.amount) >= min);
		}
		if (!isNaN(max)) {
			filtered = filtered.filter((t) => Math.abs(t.amount) <= max);
		}

		// Sort
		filtered = [...filtered].sort((a, b) => {
			let comparison = 0;

			switch (sortField) {
				case "name":
					comparison = a.name.localeCompare(b.name);
					break;
				case "amount":
					comparison = Math.abs(a.amount) - Math.abs(b.amount);
					break;
				case "date":
					comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
					break;
				case "category":
					comparison = (a.category_name || "").localeCompare(b.category_name || "");
					break;
				case "type":
					comparison = inferTransactionType(a).localeCompare(inferTransactionType(b));
					break;
			}

			return sortDirection === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [transactions, searchQuery, categoryFilter, effectiveTypeFilter, sortField, sortDirection, minAmount, maxAmount]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("desc");
		}
	};

	const clearAllFilters = () => {
		setSearchQuery("");
		setCategoryFilter("all");
		setTypeFilter("all");
		setMinAmount("");
		setMaxAmount("");
		onClearExternalFilter?.();
	};

	const hasActiveFilters =
		searchQuery || categoryFilter !== "all" || typeFilter !== "all" || externalTypeFilter || minAmount || maxAmount;

	const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
		<button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-primary transition-colors">
			{children}
			{sortField === field ? (
				sortDirection === "asc" ? (
					<ChevronUp className="h-3.5 w-3.5 text-info" />
				) : (
					<ChevronDown className="h-3.5 w-3.5 text-info" />
				)
			) : (
				<ArrowUpDown className="h-3.5 w-3.5 text-primary" />
			)}
		</button>
	);

	return (
		<Card className="p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Transaction Ledger</h3>
					<p className="text-xs text-primary mt-0.5">
						{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"} this month
					</p>
				</div>
			</div>

			{/* ... Filters ... */}
			{/* I will only replace the render part to avoid touching the whole file if possible, but the filters are in the middle. */}
			{/* Let's do a larger replace to be safe with context. */}

			{/* Filters Row */}
			<div className="flex items-center gap-3 mb-4">
				{/* Search */}
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
					<Input
						type="text"
						placeholder="Search transactions..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9 bg-background border-border"
					/>
				</div>

				{/* Category Filter */}
				<Select value={categoryFilter} onValueChange={setCategoryFilter}>
					<SelectTrigger className="w-48 bg-background border-border">
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

				{/* Type Filter */}
				<Select
					value={externalTypeFilter || typeFilter}
					onValueChange={(v) => {
						if (externalTypeFilter) {
							onClearExternalFilter?.();
						}
						setTypeFilter(v as TransactionType | "all");
					}}
				>
					<SelectTrigger className="w-44 bg-background border-border">
						<SelectValue placeholder="All Types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						{Object.entries(TRANSACTION_TYPE_CONFIG).map(([type, config]) => (
							<SelectItem key={type} value={type}>
								<div className="flex items-center gap-2">
									<config.icon className={cn("h-4 w-4", config.textColor)} />
									{config.label}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Advanced Filters Toggle */}
				<Button
					variant="outline"
					size="default"
					onClick={() => setShowFilters(!showFilters)}
					className={cn(showFilters && "bg-muted")}
				>
					<Filter className="h-4 w-4" />
				</Button>

				{/* Clear Filters */}
				{hasActiveFilters && (
					<Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-primary hover:text-primary">
						<X className="h-4 w-4 mr-1" />
						Clear
					</Button>
				)}
			</div>

			{/* Advanced Filters (Amount Range) */}
			{showFilters && (
				<div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
					<span className="text-sm text-primary">Amount:</span>
					<Input
						type="number"
						inputMode="decimal"
						placeholder="Min"
						value={minAmount}
						onChange={(e) => setMinAmount(e.target.value)}
						className="w-24 h-8 text-sm"
					/>
					<span className="text-primary">to</span>
					<Input
						type="number"
						inputMode="decimal"
						placeholder="Max"
						value={maxAmount}
						onChange={(e) => setMaxAmount(e.target.value)}
						className="w-24 h-8 text-sm"
					/>
				</div>
			)}

			{/* External Filter Badge */}
			{externalTypeFilter && (
				<div className="flex items-center gap-2 mb-4">
					<span className="text-sm text-primary">Filtered by:</span>
					<Badge
						variant="secondary"
						className={cn(
							TRANSACTION_TYPE_CONFIG[externalTypeFilter].bgColor,
							TRANSACTION_TYPE_CONFIG[externalTypeFilter].textColor,
							"gap-1.5"
						)}
					>
						{TRANSACTION_TYPE_CONFIG[externalTypeFilter].label}
						<button onClick={onClearExternalFilter} className="ml-1 hover:opacity-70">
							<X className="h-3 w-3" />
						</button>
					</Badge>
				</div>
			)}

			{/* Table */}
			<div className="border border-border rounded-lg overflow-hidden shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="bg-muted/50 border-b border-border">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider w-[100px]">
									<SortButton field="date">Date</SortButton>
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider">
									<SortButton field="name">Name</SortButton>
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider w-[140px]">
									<SortButton field="category">Category</SortButton>
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider w-[120px]">
									<SortButton field="type">Type</SortButton>
								</th>
								<th className="px-4 py-3 text-right text-xs font-semibold text-primary uppercase tracking-wider w-[100px]">
									<SortButton field="amount">Amount</SortButton>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-card">
							{filteredTransactions.length === 0 ? (
								<tr>
									<td colSpan={5} className="px-4 py-12 text-center text-primary">
										{hasActiveFilters ? "No transactions match your filters" : "No transactions for this month"}
									</td>
								</tr>
							) : (
								filteredTransactions.map((transaction) => {
									const txType = inferTransactionType(transaction);

									// Resolve category color based on index in the categories array
									const categoryIndex = categories.findIndex((c) => c.id === transaction.category_id);
									const categoryStyle =
										categoryIndex !== -1
											? getCategoryColor(categoryIndex)
											: { bg: "bg-secondary", text: "text-primary", light: "bg-secondary/50" };

									return (
										<tr
											key={transaction.id}
											className="hover:bg-muted/30 transition-colors cursor-pointer group"
											onClick={() => handleEditTransaction(transaction)}
										>
											<td className="px-4 py-3 whitespace-nowrap">
												<span className="text-sm text-primary">
													{new Date(transaction.transaction_date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
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
													<Badge
														variant="secondary"
														className={cn(
															categoryIndex !== -1 ? categoryStyle.light : "bg-secondary",
															categoryIndex !== -1 ? categoryStyle.text : "text-primary",
															"font-medium border-0"
														)}
													>
														{transaction.category_name}
													</Badge>
												) : (
													<span className="text-xs text-primary">Uncategorized</span>
												)}
											</td>
											<td className="px-4 py-3">
												<TransactionTypeIcon type={txType} size="sm" showLabel />
											</td>
											<td className="px-4 py-3 text-right whitespace-nowrap">
												<span
													className={cn(
														"text-sm font-semibold",
														transaction.amount > 0 ? "text-success" : "text-error"
													)}
												>
													{transaction.amount > 0 ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
												</span>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Count */}
			{filteredTransactions.length > 0 && (
				<div className="mt-3 text-xs text-primary text-right">
					Showing {filteredTransactions.length} of {transactions.length}{" "}
					{transactions.length === 1 ? "transaction" : "transactions"}
				</div>
			)}

			<TransactionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				transaction={selectedTransaction}
				categories={categories}
			/>
		</Card>
	);
}
