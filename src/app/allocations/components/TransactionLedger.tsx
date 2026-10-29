"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X, ArrowUpDown, ChevronUp, ChevronDown, Ban, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import { formatAccountDisplayName } from "@/lib/account-utils";
import { sortAlphabetically } from "@/lib/sort-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SurfaceSection } from "@/components/layout/surface-section";
import { formatCurrency } from "@/app/dashboard/utils";
import type { AccountWithType } from "@/app/accounts/types";
import type { AllocationCategory, Transaction } from "../types";
import { getLinkedAccountIds, getTransferAccountIds } from "../utils/transfer-accounts";
import { accountHref } from "@/lib/account-links";
import type { TransactionType } from "./TransactionTypeIcon";
import { inferTransactionType, TRANSACTION_TYPE_CONFIG } from "./TransactionTypeIcon";
import { getCategoryColor } from "../utils/colors";
import { TransactionDialog } from "./TransactionDialog";
import { getCurrencySymbol } from "@/lib/format";

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
		const { fromAccountId, toAccountId } = getTransferAccountIds(transaction);

		const from = accountName(fromAccountId) ?? "External";
		const to = accountName(toAccountId) ?? "External";
		return `${from} → ${to}`;
	}

	return accountName(transaction.account_id ?? transaction.linked_account_transaction?.account_id ?? null) ?? "—";
}

/** The Account cell: each tracked account links to its page; anything else reads as in the label. */
function AccountCell({ transaction, accounts }: { transaction: Transaction; accounts: AccountWithType[] }) {
	const linked = getLinkedAccountIds(transaction)
		.map((id) => accounts.find((account) => account.id === id))
		.filter((account): account is AccountWithType => !!account);
	const isTransfer = transaction.source === "transfer";
	const expected = isTransfer ? 2 : 1;
	if (linked.length < expected) return <>{resolveAccountLabel(transaction, accounts)}</>;

	return (
		<>
			{linked.map((account, index) => (
				<Fragment key={account.id}>
					{index > 0 && " → "}
					<Link
						href={accountHref(account.id)}
						onClick={(event) => event.stopPropagation()}
						className="underline-offset-2 hover:text-primary hover:underline"
					>
						{formatAccountDisplayName(account)}
					</Link>
				</Fragment>
			))}
		</>
	);
}

function compareTransactions(a: Transaction, b: Transaction, field: SortField, accounts: AccountWithType[]): number {
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

	const [minAmount, setMinAmount] = useState<string>("");
	const [maxAmount, setMaxAmount] = useState<string>("");

	const effectiveTypeFilter = externalTypeFilter || (typeFilter !== "all" ? typeFilter : null);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

	const handleEditTransaction = (transaction: Transaction) => {
		setSelectedTransaction(transaction);
		setDialogOpen(true);
	};

	// A link from an account page (?transaction=<id>) opens that row once, then leaves the URL.
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const linkedTransactionId = searchParams.get("transaction");
	useEffect(() => {
		if (!linkedTransactionId) return;
		const linked = transactions.find((t) => t.id === linkedTransactionId);
		if (linked) handleEditTransaction(linked);
		const params = new URLSearchParams(searchParams.toString());
		params.delete("transaction");
		const query = params.toString();
		// Only the URL changes, so skip router.replace's server render of the whole page.
		window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
	}, [linkedTransactionId, transactions]);

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
	}, [transactions, accounts, searchQuery, categoryFilter, effectiveTypeFilter, sorts, minAmount, maxAmount]);

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
				className={cn(
					"inline-flex items-center gap-1 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					isActive && "text-primary"
				)}
				title="Click to sort. Shift-click to add it as a second sort."
			>
				{children}
				{isActive ? (
					sorts[index].direction === "asc" ? (
						<ChevronUp className="h-3.5 w-3.5" />
					) : (
						<ChevronDown className="h-3.5 w-3.5" />
					)
				) : (
					<ArrowUpDown className="h-3 w-3 opacity-40" />
				)}
				{sorts.length > 1 && isActive && (
					<span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold">
						{index + 1}
					</span>
				)}
			</button>
		);
	};

	const categoryColor = (categoryId?: string | null) => {
		if (!categoryId) return null;
		const category = categories.find((c) => c.id === categoryId);
		return getCategoryColor(categoryId, category?.color, category?.display_order);
	};

	const formatAmount = (transaction: Transaction) => {
		const txType = inferTransactionType(transaction);
		const value = formatCurrency(Math.abs(transaction.amount), { showCents: true });
		if (txType === "transfer") return { text: value, tone: "text-muted-foreground" };
		return transaction.amount > 0
			? { text: `+${value}`, tone: "text-success" }
			: { text: `−${value}`, tone: "text-primary" };
	};

	const amountFilterActive = Boolean(minAmount || maxAmount);

	return (
		<SurfaceSection
			id="transactions-heading"
			title="Transactions"
			note={`${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"} this month`}
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<div className="relative w-full sm:max-w-xs sm:flex-1">
					<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
					<Input
						type="search"
						aria-label="Search transactions"
						placeholder="Search transactions"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="rounded-full pl-10"
					/>
				</div>

				<div className="scrollbar-hide -mx-1 flex items-center gap-2 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
					<Select value={categoryFilter} onValueChange={setCategoryFilter}>
						<SelectTrigger aria-label="Category" className="w-auto shrink-0 gap-2 rounded-full sm:w-44">
							<SelectValue placeholder="All categories" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All categories</SelectItem>
							{sortAlphabetically(categories, (cat) => cat.name).map((cat) => (
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
						<SelectTrigger aria-label="Type" className="w-auto shrink-0 gap-2 rounded-full sm:w-40">
							<SelectValue placeholder="All types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All types</SelectItem>
							{sortAlphabetically(Object.entries(TRANSACTION_TYPE_CONFIG), ([, config]) => config.label).map(
								([type, config]) => (
									<SelectItem key={type} value={type}>
										<div className="flex items-center gap-2">
											<config.icon className={cn("h-4 w-4", config.textColor)} />
											{config.label}
										</div>
									</SelectItem>
								)
							)}
						</SelectContent>
					</Select>

					<Popover>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								className={cn(
									"h-10 shrink-0 gap-2 rounded-full px-3.5",
									amountFilterActive && "border-primary text-primary"
								)}
							>
								<SlidersHorizontal className="h-4 w-4" aria-hidden />
								{amountFilterActive
									? `${minAmount ? formatCurrency(Number(minAmount)) : "Any"} to ${maxAmount ? formatCurrency(Number(maxAmount)) : "any"}`
									: "Amount"}
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-64 rounded-2xl p-4">
							<p className="type-label text-primary">Amount between</p>
							<div className="mt-3 flex items-center gap-2">
								<Input
									type="text"
									inputMode="decimal"
									aria-label="Minimum amount"
									placeholder="Min"
									startAdornment={getCurrencySymbol()}
									value={minAmount}
									onChange={(e) => setMinAmount(sanitizeDecimalInput(e.target.value, 2))}
								/>
								<span className="type-body-sm text-muted-foreground">and</span>
								<Input
									type="text"
									inputMode="decimal"
									aria-label="Maximum amount"
									placeholder="Max"
									startAdornment={getCurrencySymbol()}
									value={maxAmount}
									onChange={(e) => setMaxAmount(sanitizeDecimalInput(e.target.value, 2))}
								/>
							</div>
						</PopoverContent>
					</Popover>

					{hasActiveFilters && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleReset}
							className="h-10 shrink-0 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-primary"
						>
							<RotateCcw className="h-3.5 w-3.5" aria-hidden />
							Clear
						</Button>
					)}
				</div>
			</div>

			{externalTypeFilter && (
				<div className="mt-3 flex items-center gap-2">
					<span className="type-body-sm text-muted-foreground">Showing only</span>
					<Badge
						variant="secondary"
						className={cn(
							TRANSACTION_TYPE_CONFIG[externalTypeFilter].bgColor,
							TRANSACTION_TYPE_CONFIG[externalTypeFilter].textColor,
							"gap-1.5"
						)}
					>
						{TRANSACTION_TYPE_CONFIG[externalTypeFilter].label}
						<button onClick={onClearExternalFilter} className="ml-1 hover:opacity-70" aria-label="Clear type filter">
							<X className="h-3 w-3" />
						</button>
					</Badge>
				</div>
			)}

			{filteredTransactions.length === 0 ? (
				<p className="type-body-sm mt-4 rounded-2xl border border-dashed border-border py-10 text-center text-muted-foreground">
					{hasActiveFilters ? "No transactions match these filters." : "No transactions this month yet."}
				</p>
			) : (
				<>
					{/* Desktop: sortable table */}
					<div className="mt-4 hidden overflow-x-auto md:block">
						<table className="w-full">
							<thead>
								<tr className="type-body-xs border-b border-border/70 text-left text-muted-foreground">
									<th className="w-[92px] px-3 pb-2 font-normal">
										<SortButton field="date">Date</SortButton>
									</th>
									<th className="px-3 pb-2 font-normal">
										<SortButton field="name">Name</SortButton>
									</th>
									<th className="w-[170px] px-3 pb-2 font-normal">
										<SortButton field="category">Category</SortButton>
									</th>
									<th className="w-[210px] px-3 pb-2 font-normal">
										<SortButton field="account">Account</SortButton>
									</th>
									<th className="w-[140px] px-3 pb-2 font-normal">
										<SortButton field="type">Type</SortButton>
									</th>
									<th className="w-[120px] px-3 pb-2 text-right font-normal">
										<span className="inline-flex justify-end">
											<SortButton field="amount">Amount</SortButton>
										</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/50">
								{filteredTransactions.map((transaction) => {
									const txType = inferTransactionType(transaction);
									const color = categoryColor(transaction.category_id);
									const amount = formatAmount(transaction);
									const TypeIcon = TRANSACTION_TYPE_CONFIG[txType].icon;

									return (
										<tr
											key={transaction.id}
											tabIndex={0}
											data-shortcut-scope="transaction-row"
											className="row-interactive cursor-pointer"
											onClick={() => handleEditTransaction(transaction)}
											onKeyDown={(event) => {
												if (event.shiftKey && event.key === "Enter") {
													event.preventDefault();
													handleEditTransaction(transaction);
												}
											}}
										>
											<td className="type-body-sm whitespace-nowrap px-3 py-3 text-muted-foreground">
												{transaction.transaction_date
													? formatShortDate(parseLocalDate(transaction.transaction_date))
													: ""}
											</td>
											<td className="px-3 py-3">
												<div className="flex flex-wrap items-center gap-2">
													<span className="type-body-sm font-medium text-primary">{transaction.name}</span>
													{transaction.is_recurring_stopped && (
														<Badge
															variant="outline"
															className="gap-1 border-warning/40 bg-warning-muted px-1.5 py-0 text-[10px] font-medium text-warning"
															title="Its recurring item was paused or deleted, so this is the last one."
														>
															<Ban className="h-2.5 w-2.5" /> Last payment
														</Badge>
													)}
												</div>
												{transaction.notes && (
													<div className="type-body-xs max-w-[240px] truncate text-muted-foreground">
														{transaction.notes}
													</div>
												)}
											</td>
											<td className="px-3 py-3">
												<span className="type-body-sm inline-flex items-center gap-2 text-text-secondary">
													<span
														className={cn("h-2 w-2 shrink-0 rounded-full", color ? color.bg : "bg-primary/25")}
														aria-hidden
													/>
													{transaction.category_name || "Uncategorized"}
												</span>
											</td>
											<td className="type-body-sm px-3 py-3 text-muted-foreground">
												<AccountCell transaction={transaction} accounts={accounts} />
											</td>
											<td className="px-3 py-3">
												<span className="type-body-sm inline-flex items-center gap-1.5 text-muted-foreground">
													<TypeIcon
														className={cn("h-3.5 w-3.5", TRANSACTION_TYPE_CONFIG[txType].textColor)}
														aria-hidden
													/>
													{TRANSACTION_TYPE_CONFIG[txType].label}
												</span>
											</td>
											<td className={cn("type-value whitespace-nowrap px-3 py-3 text-right", amount.tone)}>
												{amount.text}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						<p className="type-body-xs mt-3 text-muted-foreground">
							Showing {filteredTransactions.length} of {transactions.length}. Shift-click a column to sort by it as
							well.
						</p>
					</div>

					{/* Phone: one row per transaction */}
					<ul className="mt-3 divide-y divide-border/50 md:hidden">
						{filteredTransactions.map((transaction) => {
							const color = categoryColor(transaction.category_id);
							const amount = formatAmount(transaction);
							return (
								<li key={transaction.id}>
									<button
										type="button"
										onClick={() => handleEditTransaction(transaction)}
										className="row-interactive flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left"
									>
										<span
											className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color ? color.bg : "bg-primary/25")}
											aria-hidden
										/>
										<span className="min-w-0 flex-1">
											<span className="type-body-sm block truncate font-medium text-primary">{transaction.name}</span>
											<span className="type-body-xs block truncate text-muted-foreground">
												{transaction.transaction_date
													? formatShortDate(parseLocalDate(transaction.transaction_date))
													: ""}
												{", "}
												{transaction.category_name || "Uncategorized"}
											</span>
										</span>
										<span className={cn("type-value shrink-0", amount.tone)}>{amount.text}</span>
									</button>
								</li>
							);
						})}
					</ul>
				</>
			)}

			<TransactionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				transaction={selectedTransaction}
				categories={categories}
				accounts={accounts}
				boundaryMonth={currentMonth}
			/>
		</SurfaceSection>
	);
}
