"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { AccountWithType, AccountTransaction } from "./types";
import { NetWorthSummary } from "./components/NetWorthSummary";
import { AccountCard } from "./components/AccountCard";
import { AccountDetailPanel } from "./components/AccountDetailPanel";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
import { AccountAdjustmentDialog } from "./components/AccountAdjustmentDialog";
import { getAccountTransactions } from "./actions";
import type { AllocationCategory } from "@/app/allocations/types";
import { toast } from "sonner";

import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

interface BalanceSheetClientProps {
	initialAccounts: AccountWithType[];
	initialCategories: AllocationCategory[];
	initialSummary: {
		totalAssets: number;
		totalLiabilities: number;
		netWorth: number;
		previousTotalAssets?: number;
		previousTotalLiabilities?: number;
		previousNetWorth?: number;
	};
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
				{/* Top Row: Net Worth Summary */}
				<div className="w-full">
					<NetWorthSummary
						totalAssets={summary.totalAssets}
						totalLiabilities={summary.totalLiabilities}
						netWorth={summary.netWorth}
						previousTotalAssets={summary.previousTotalAssets}
						previousTotalLiabilities={summary.previousTotalLiabilities}
						previousNetWorth={summary.previousNetWorth}
					/>
				</div>

				{/* Master-Detail Layout */}
				<div className="flex gap-6 min-h-[600px]">
					{/* Sidebar - Account List */}
					<div className="w-80 flex flex-col gap-4 overflow-hidden">
						{/* Search */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search accounts..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>

						{/* Scrollable Account List */}
						<div className="flex-1 overflow-y-auto space-y-4">
							{/* Assets */}
							{filteredAssets.length > 0 && (
								<div className="space-y-2">
									<div className="flex items-center justify-between px-1">
										<h3 className="text-sm font-semibold text-muted-foreground uppercase">Assets</h3>
										<span className="text-sm font-semibold text-green-600 dark:text-green-400">
											{formatCurrency(summary.totalAssets)}
										</span>
									</div>
									{filteredAssets.map((account) => (
										<AccountCard
											key={account.id}
											account={account}
											isSelected={selectedAccount?.id === account.id}
											onClick={() => handleAccountClick(account)}
										/>
									))}
								</div>
							)}

							{/* Liabilities */}
							{filteredLiabilities.length > 0 && (
								<div className="space-y-2">
									<div className="flex items-center justify-between px-1">
										<h3 className="text-sm font-semibold text-muted-foreground uppercase">Liabilities</h3>
										<span className="text-sm font-semibold text-red-600 dark:text-red-400">
											{formatCurrency(summary.totalLiabilities)}
										</span>
									</div>
									{filteredLiabilities.map((account) => (
										<AccountCard
											key={account.id}
											account={account}
											isSelected={selectedAccount?.id === account.id}
											onClick={() => handleAccountClick(account)}
										/>
									))}
								</div>
							)}

							{filteredAssets.length === 0 && filteredLiabilities.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									<p className="text-sm">{searchQuery ? "No accounts found" : "No accounts yet"}</p>
								</div>
							)}
						</div>
					</div>

					{/* Main Panel - Account Details */}
					<div className="flex-1 overflow-hidden">
						<AccountDetailPanel
							account={selectedAccount}
							transactions={transactions}
							isLoadingTransactions={isLoadingTransactions}
							onDelete={() => toast.info("Delete functionality coming soon")}
							onRecordTransaction={() => setTransactionDialogOpen(true)}
							onAdjustBalance={() => setAdjustmentDialogOpen(true)}
						/>
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
