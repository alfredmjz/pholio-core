"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { AccountWithType, AccountTransaction, BalanceSheetSummary } from "./types";
import { NetWorthCard } from "./components/NetWorthCard";
import { AssetGrowthCard } from "./components/AssetGrowthCard";
import { DebtRundownCard } from "./components/DebtRundownCard";
import { RecentActivity } from "./components/RecentActivity";
import { AccountCard } from "./components/AccountCard";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
import { AccountAdjustmentDialog } from "./components/AccountAdjustmentDialog";
import { getAccountTransactions } from "./actions";
import type { AllocationCategory } from "@/app/allocations/types";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

interface BalanceSheetClientProps {
	initialAccounts: AccountWithType[];
	initialCategories: AllocationCategory[];
	initialSummary: BalanceSheetSummary;
}

export function BalanceSheetClient({ initialAccounts, initialCategories, initialSummary }: BalanceSheetClientProps) {
	const [accounts, setAccounts] = useState<AccountWithType[]>(initialAccounts);
	const router = useRouter();
	const [selectedAccount, setSelectedAccount] = useState<AccountWithType | null>(initialAccounts[0] || null);
	const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(!!(initialAccounts && initialAccounts.length > 0));
	const [searchQuery, setSearchQuery] = useState("");
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
	const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

	// Transaction cache for optimistic loading
	const transactionCache = useRef<Map<string, AccountTransaction[]>>(new Map());

	const assetAccounts = accounts.filter((acc) => acc.account_type?.class === "asset");
	const liabilityAccounts = accounts.filter((acc) => acc.account_type?.class === "liability");

	const filteredAssets = assetAccounts.filter((acc) => acc.name.toLowerCase().includes(searchQuery.toLowerCase()));
	const filteredLiabilities = liabilityAccounts.filter((acc) =>
		acc.name.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Load transactions when account is selected
	useEffect(() => {
		if (selectedAccount) {
			const accountId = selectedAccount.id;
			const cachedTransactions = transactionCache.current.get(accountId);

			if (cachedTransactions) {
				// If cached, show immediately without loading state
				setTransactions(cachedTransactions);
				setIsLoadingTransactions(false);
				// Still fetch in background to refresh cache
				refreshTransactionsInBackground(accountId);
			} else {
				// No cache: show loading state and fetch
				setTransactions([]);
				loadTransactions(accountId);
			}
		}
	}, [selectedAccount]);

	const loadTransactions = async (accountId: string) => {
		setIsLoadingTransactions(true);
		try {
			const txns = await getAccountTransactions(accountId);
			setTransactions(txns);
			// Update cache
			transactionCache.current.set(accountId, txns);
		} catch (error) {
			console.error("Failed to load transactions:", error);
			setTransactions([]);
		} finally {
			setIsLoadingTransactions(false);
		}
	};

	// Background refresh: updates cache silently without loading state
	const refreshTransactionsInBackground = async (accountId: string) => {
		try {
			const txns = await getAccountTransactions(accountId);
			transactionCache.current.set(accountId, txns);
			// Only update UI if still viewing the same account
			if (selectedAccount?.id === accountId) {
				setTransactions(txns);
			}
		} catch (error) {
			console.error("Failed to refresh transactions:", error);
		}
	};

	const handleAccountSuccess = (newAccount: AccountWithType) => {
		// Optimistically add the new account to the list
		setAccounts((prev) => [...prev, newAccount]);
		// Select the new account
		setSelectedAccount(newAccount);
		// Revalidate in background
		router.refresh();
	};

	const handleTransactionSuccess = (accountId: string, amount: number, transactionType: string) => {
		// Optimistically update the account balance
		setAccounts((prev) =>
			prev.map((acc) => {
				if (acc.id !== accountId) return acc;

				let newBalance = acc.current_balance;
				if (acc.account_type?.class === "asset") {
					// Assets: deposits increase, withdrawals decrease
					if (transactionType === "deposit") {
						newBalance += amount;
					} else if (transactionType === "withdrawal") {
						newBalance -= amount;
					}
				} else {
					// Liabilities: payments decrease
					if (transactionType === "payment") {
						newBalance -= amount;
					}
				}

				return { ...acc, current_balance: newBalance };
			})
		);

		// Reload transactions for the current account
		if (selectedAccount) {
			loadTransactions(selectedAccount.id);
		}

		// Revalidate in background
		router.refresh();
	};

	const handleAccountClick = (account: AccountWithType) => {
		if (selectedAccount?.id === account.id) return;
		setSelectedAccount(account);
		// Reset state immediately to show skeleton and avoid flashing old data
		setTransactions([]);
		setIsLoadingTransactions(true);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-CA", {
			style: "currency",
			currency: "CAD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	// Calculate real-time summary from current accounts state
	const summary = useMemo(() => {
		const totalAssets = assetAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
		const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
		const netWorth = totalAssets - totalLiabilities;

		return {
			totalAssets,
			totalLiabilities,
			netWorth,
			previousTotalAssets: initialSummary.previousTotalAssets,
			previousTotalLiabilities: initialSummary.previousTotalLiabilities,
			previousNetWorth: initialSummary.previousNetWorth,
		};
	}, [assetAccounts, liabilityAccounts, initialSummary]);

	return (
		<PageShell>
			<PageHeader
				isSticky={false}
				className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
			>
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Balance Sheet</h1>
					<p className="text-sm text-muted-foreground">Track your assets and liabilities</p>
				</div>
				<Button onClick={() => setAddDialogOpen(true)}>
					<Plus className="h-4 w-4 mr-2" />
					Add Account
				</Button>
			</PageHeader>

			<PageContent>
				<div className="flex flex-col gap-6">
					{/* Top Cards Row */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<NetWorthCard
							netWorth={summary.netWorth}
							totalAssets={summary.totalAssets}
							totalLiabilities={summary.totalLiabilities}
							previousNetWorth={summary.previousNetWorth}
						/>
						<AssetGrowthCard
							totalAssets={summary.totalAssets}
							previousTotalAssets={summary.previousTotalAssets}
							historicalData={initialSummary.historicalAssets || []}
						/>
						<DebtRundownCard
							totalLiabilities={summary.totalLiabilities}
							previousTotalLiabilities={summary.previousTotalLiabilities}
							historicalData={initialSummary.historicalLiabilities || []}
						/>
					</div>

					{/* Main Content: Account List and Activity */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{/* All Accounts List */}
						<Card className="lg:col-span-2 flex flex-col overflow-hidden bg-background/50 border shadow-sm">
							<div className="p-6 border-border border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
								<div>
									<h2 className="text-xl font-bold">All Accounts</h2>
									<p className="text-sm text-muted-foreground">{accounts.length} accounts</p>
								</div>
								<div className="flex items-center gap-2 w-full sm:w-auto">
									<div className="relative flex-1 sm:w-64">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="Search..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="pl-9 h-10"
										/>
									</div>
									<Select defaultValue="all">
										<SelectTrigger className="w-[120px] h-10">
											<SelectValue placeholder="All" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All</SelectItem>
											<SelectItem value="assets">Assets</SelectItem>
											<SelectItem value="liabilities">Liabilities</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="flex-1 overflow-y-auto">
								{/* Account Items */}
								<div className="flex flex-col divide-y divide-border">
									{filteredAssets.concat(filteredLiabilities).map((account) => (
										<AccountCard
											key={account.id}
											account={account}
											onClick={() => {
												setSelectedAccount(account);
												setAdjustmentDialogOpen(true);
											}}
										/>
									))}

									{filteredAssets.length === 0 && filteredLiabilities.length === 0 && (
										<div className="p-12 text-center text-muted-foreground">
											<p>{searchQuery ? "No accounts found" : "No accounts yet"}</p>
										</div>
									)}
								</div>
							</div>
						</Card>

						{/* Recent Activity Feed */}
						<div className="lg:col-span-1">
							<RecentActivity />
						</div>
					</div>
				</div>
			</PageContent>

			{/* Dialogs */}
			<AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={handleAccountSuccess} />
			<UnifiedTransactionDialog
				open={transactionDialogOpen}
				onOpenChange={setTransactionDialogOpen}
				categories={initialCategories}
				accounts={accounts}
				defaultAccountId={selectedAccount?.id}
				onSuccess={() => selectedAccount && handleTransactionSuccess(selectedAccount.id, 0, "adjustment")}
				context="balancesheet"
			/>
			<AccountAdjustmentDialog
				open={adjustmentDialogOpen}
				onOpenChange={setAdjustmentDialogOpen}
				account={selectedAccount}
				onSuccess={handleTransactionSuccess}
			/>
		</PageShell>
	);
}
