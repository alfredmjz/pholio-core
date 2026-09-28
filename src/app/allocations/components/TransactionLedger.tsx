"use client";

import { useState, useMemo } from "react";
import { Search, Filter, X, ArrowUpDown, ChevronUp, ChevronDown, Ban, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import { formatAccountDisplayName } from "@/lib/account-utils";
import { SHORTCUTS, ShortcutId } from "@/lib/keyboard-shortcuts";
import { ShortcutHint } from "@/components/common/shortcut-hint";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { AllocationCategory, Transaction } from "../types";
import type { TransactionType } from "./TransactionTypeIcon";
import { inferTransactionType, TRANSACTION_TYPE_CONFIG, TransactionTypeIcon } from "./TransactionTypeIcon";
import { getCategoryColor } from "./CategoryPerformance";
import { TransactionDialog } from "./TransactionDialog";

interface TransactionLedgerProps {
	transactions: Transaction[];
	categories: AllocationCategory[];
	accounts?: AccountWithType[];
	externalTypeFilter?: TransactionType | null;
	onClearExternalFilter?: () => void;
	onTransactionSuccess?: () => void;
	currentMonth?: { year: number; month: number };
}

type SortField = "date" | "name" | "amount" | "category" | "account" | "type";
type SortDirection = "asc" | "desc";

interface SortCriterion {
	field: SortField;
	direction: SortDirection;
}

const TEXT_SORT_FIELDS: SortField[] = ["name", "category", "account", "type"];

function defaultSortDirection(field: SortField): SortDirection {
	return TEXT_SORT_FIELDS.includes(field) ? "asc" : "desc";
}

/**
 * Resolve the account label shown in the ledger's "Accounts" column.
 * Transfers show "source → destination"; any side that cannot be matched to a
 * tracked account is rendered as "External". Non-transfers show their single
 * account, or an em dash when the transaction is not tagged to an account.
 */
function resolveAccountLabel(transaction: Transaction, accounts: AccountWithType[]): string {
	const accountName = (accountId?: string | null): string | null => {
		if (!accountId) return null;
		const account = accounts.find((a) => a.id === accountId);
		return account ? formatAccountDisplayName(account) : null;
	};

	if (transaction.source === "transfer") {
		const linked = transaction.linked_account_transactions ?? [];
		const sourceTxId = transaction.linked_account_transaction?.id;
		const sourceId = transaction.linked_account_transaction?.account_id ?? transaction.account_id ?? null;
		const destinationId =
			linked.find((entry) => entry.id !== sourceTxId && entry.account_id !== sourceId)?.account_id ?? null;

		const from = accountName(sourceId) ?? "External";
		const to = accountName(destinationId) ?? "External";
		return `${from} → ${to}`;
	}

	return accountName(transaction.account_id ?? transaction.linked_account_transaction?.account_id ?? null) ?? "—";
}

function compareTransactions(
	a: Transaction,
	b: Transaction,
	field: SortField,
	accounts: AccountWithType[]
): number {
	switch (field) {
		case "name":
			return a.name.localeCompare(b.name);
		case "amount":
			return Math.abs(a.amount) - Math.abs(b.amount);
		case "date":
			return new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
		case "category":
			return (a.category_name || "").localeCompare(b.category_name || "");
		case "account":
			return resolveAccountLabel(a, accounts).localeCompare(resolveAccountLabel(b, accounts));
		case "type":
			return inferTransactionType(a).localeCompare(inferTransactionType(b));
		default:
			return 0;
	}
}

const LEGEND_SHORTCUTS = [ShortcutId.SortColumn, ShortcutId.SecondarySort];

export function TransactionLedger({
	transactions,
	categories,
	accounts = [],
	externalTypeFilter,
	onClearExternalFilter,
	onTransactionSuccess,
	currentMonth,
}: TransactionLedgerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
	const [sorts, setSorts] = useState<SortCriterion[]>([{ field: "date", direction: "desc" }]);
	const [showFilters, setShowFilters] = useState(false);

	const [minAmount, setMinAmount] = useState<string>("");
	const [maxAmount, setMaxAmount] = useState<string>("");

	const effectiveTypeFilter = externalTypeFilter || (typeFilter !== "all" ? typeFilter : null);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

	const handleEditTransaction = (transaction: Transaction) => {
		setSelectedTransaction(transaction);
		setDialogOpen(true);
	};

	const filteredTransactions = useMemo(() => {
		let filtered = transactions;

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.category_name?.toLowerCase().includes(query) ||
					t.notes?.toLowerCase().includes(query)
			);
		}

		if (categoryFilter !== "all") {
			filtered = filtered.filter((t) => t.category_id === categoryFilter);
		}

		if (effectiveTypeFilter) {
			filtered = filtered.filter((t) => inferTransactionType(t) === effectiveTypeFilter);
		}

		const min = parseFloat(minAmount);
		const max = parseFloat(maxAmount);
		if (!isNaN(min)) {
			filtered = filtered.filter((t) => Math.abs(t.amount) >= min);
		}
		if (!isNaN(max)) {
			filtered = filtered.filter((t) => Math.abs(t.amount) <= max);
		}

		filtered = [...filtered].sort((a, b) => {
			for (const { field, direction } of sorts) {
				const comparison = compareTransactions(a, b, field, accounts);
				if (comparison !== 0) {
					return direction === "asc" ? comparison : -comparison;
				}
			}

			// Stable tie-breaker so equal rows keep a deterministic, newest-first order.
			return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
		});

		return filtered;
	}, [
		transactions,
		accounts,
		searchQuery,
		categoryFilter,
		effectiveTypeFilter,
		sorts,
		minAmount,
		maxAmount,
	]);

	const toggleSort = (field: SortField, additive: boolean) => {
		setSorts((prev) => {
			const existingIndex = prev.findIndex((criterion) => criterion.field === field);

			if (!additive) {
				// Plain click: a fresh single-column sort, or toggle if already the primary.
				if (prev.length === 1 && existingIndex === 0) {
					return [{ field, direction: prev[0].direction === "asc" ? "desc" : "asc" }];
				}
				return [{ field, direction: defaultSortDirection(field) }];
			}

			// Shift+click: add a secondary sort, cycle its direction, or remove it.
			if (existingIndex === -1) {
				return [...prev, { field, direction: defaultSortDirection(field) }];
			}

			const next = [...prev];
			const current = next[existingIndex];
			if (current.direction === "asc") {
				next[existingIndex] = { ...current, direction: "desc" };
			} else {
				next.splice(existingIndex, 1);
			}

			return next.length > 0 ? next : [{ field: "date", direction: "desc" }];
		});
	};

	const getSortIndex = (field: SortField) => sorts.findIndex((criterion) => criterion.field === field);

	const handleReset = () => {
		setSearchQuery("");
		setCategoryFilter("all");
		setTypeFilter("all");
		setMinAmount("");
		setMaxAmount("");
		onClearExternalFilter?.();
		setSorts([{ field: "date", direction: "desc" }]);
	};

	const hasActiveFilters =
		searchQuery || categoryFilter !== "all" || typeFilter !== "all" || externalTypeFilter || minAmount || maxAmount;

	const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
		const index = getSortIndex(field);
		const isActive = index !== -1;

		return (
			<button
				type="button"
				onClick={(event) => toggleSort(field, event.shiftKey)}
				className="flex items-center gap-1 hover:text-primary transition-colors"
			>
				{children}
				{isActive ? (
					sorts[index].direction === "asc" ? (
						<ChevronUp className="h-3.5 w-3.5 text-info" />
					) : (
						<ChevronDown className="h-3.5 w-3.5 text-info" />
					)
				) : (
					<ArrowUpDown className="h-3.5 w-3.5 text-primary" />
				)}
				{sorts.length > 1 && isActive && (
					<span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-info/15 text-[10px] font-semibold text-info">
						{index + 1}
					</span>
				)}
			</button>
		);
	};

	return (
		<Card className="p-6">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Transaction Ledger</h3>
					<p className="text-xs text-primary mt-0.5">
						{transactions.length} {transactions.length === 1 ? "transaction" : "transactions"} this month
					</p>
				</div>
			</div>

			<div className="flex items-center gap-3 mb-4">
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

				<Button
					variant="outline"
					size="default"
					onClick={() => setShowFilters(!showFilters)}
					className={cn(showFilters && "bg-muted")}
				>
					<Filter className="h-4 w-4" />
				</Button>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleReset}
					className="ml-auto text-muted-foreground hover:text-primary"
				>
					<RotateCcw className="h-4 w-4 mr-1" />
					Reset
				</Button>
			</div>

			{showFilters && (
				<div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
					<span className="text-sm text-primary">Amount:</span>
					<Input
						type="text"
						inputMode="decimal"
						placeholder="Min"
						value={minAmount}
						onChange={(e) => setMinAmount(sanitizeDecimalInput(e.target.value, 2))}
						className="w-24 h-8 text-sm"
					/>
					<span className="text-primary">to</span>
					<Input
						type="text"
						inputMode="decimal"
						placeholder="Max"
						value={maxAmount}
						onChange={(e) => setMaxAmount(sanitizeDecimalInput(e.target.value, 2))}
						className="w-24 h-8 text-sm"
					/>
				</div>
			)}

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

			<div className="mb-2 text-xs text-primary/50">
				<span className="font-medium text-primary/60">Legend:</span>
				<div className="mt-2 flex flex-col gap-1.5">
					{LEGEND_SHORTCUTS.map((id) => (
						<div key={id} className="flex items-center gap-2.5">
							<span>{SHORTCUTS[id].label}</span>
							<ShortcutHint keys={SHORTCUTS[id].keys} size="md" variant="plain" />
						</div>
					))}
				</div>
			</div>

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
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider w-[180px]">
									<SortButton field="category">Category</SortButton>
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider w-[200px]">
									<SortButton field="account">Accounts</SortButton>
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-primary uppercase tracking-wider w-[160px]">
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
									<td colSpan={6} className="px-4 py-12 text-center text-primary">
										{hasActiveFilters ? "No transactions match your filters" : "No transactions for this month"}
									</td>
								</tr>
							) : (
								filteredTransactions.map((transaction) => {
									const txType = inferTransactionType(transaction);

									const categoryStyle = transaction.category_id
										? getCategoryColor(transaction.category_id)
										: { bg: "bg-secondary", text: "text-primary", light: "bg-secondary/50" };

									return (
										<tr
											key={transaction.id}
											tabIndex={0}
											data-shortcut-scope="transaction-row"
											className="hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40 transition-colors cursor-pointer group"
											onClick={() => handleEditTransaction(transaction)}
											onKeyDown={(event) => {
												if (event.shiftKey && event.key === "Enter") {
													event.preventDefault();
													handleEditTransaction(transaction);
												}
											}}
										>
											<td className="px-4 py-3 whitespace-nowrap">
												<span className="text-sm text-primary">
													{transaction.transaction_date
														? formatShortDate(parseLocalDate(transaction.transaction_date))
														: ""}
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
													<Badge
														variant="secondary"
														className={cn(
															transaction.category_id ? categoryStyle.light : "bg-secondary",
															transaction.category_id ? categoryStyle.text : "text-primary",
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
												<span className="text-sm text-primary">
													{resolveAccountLabel(transaction, accounts)}
												</span>
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
				accounts={accounts}
				boundaryMonth={currentMonth}
			/>
		</Card>
	);
}
