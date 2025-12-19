"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { AccountWithType, AccountTransaction } from "./types";
import { NetWorthSummary } from "./components/NetWorthSummary";
import { AccountCard } from "./components/AccountCard";
import { AccountDetailPanel } from "./components/AccountDetailPanel";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { RecordTransactionDialog } from "./components/RecordTransactionDialog";
import { getAccountTransactions } from "./actions";
import { toast } from "sonner";

import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

interface BalanceSheetClientProps {
	initialAccounts: AccountWithType[];
	initialSummary: {
		totalAssets: number;
		totalLiabilities: number;
		netWorth: number;
		previousTotalAssets?: number;
		previousTotalLiabilities?: number;
		previousNetWorth?: number;
	};
}

export function BalanceSheetClient({ initialAccounts, initialSummary }: BalanceSheetClientProps) {
	const [accounts, setAccounts] = useState<AccountWithType[]>(initialAccounts);
	const [selectedAccount, setSelectedAccount] = useState<AccountWithType | null>(initialAccounts[0] || null);
	const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);

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

	const handleAccountSuccess = () => {
		// Reload page to fetch updated data
		window.location.reload();
	};

	const handleTransactionSuccess = () => {
		// Reload transactions and page
		if (selectedAccount) {
			loadTransactions(selectedAccount.id);
		}
		window.location.reload();
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-CA", {
			style: "currency",
			currency: "CAD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	return (
		<PageShell>
			<PageHeader>
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Balance Sheet</h1>
						<p className="text-sm text-muted-foreground mt-1">Track your assets and liabilities</p>
					</div>
					<Button onClick={() => setAddDialogOpen(true)} className="w-fit">
						<Plus className="h-4 w-4 mr-2" />
						Add Account
					</Button>
				</div>
			</PageHeader>

			<PageContent>
				{/* Top Row: Net Worth Summary */}
				<div className="w-full">
					<NetWorthSummary
						totalAssets={initialSummary.totalAssets}
						totalLiabilities={initialSummary.totalLiabilities}
						netWorth={initialSummary.netWorth}
						previousTotalAssets={initialSummary.previousTotalAssets}
						previousTotalLiabilities={initialSummary.previousTotalLiabilities}
						previousNetWorth={initialSummary.previousNetWorth}
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
											{formatCurrency(initialSummary.totalAssets)}
										</span>
									</div>
									{filteredAssets.map((account) => (
										<AccountCard
											key={account.id}
											account={account}
											isSelected={selectedAccount?.id === account.id}
											onClick={() => setSelectedAccount(account)}
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
											{formatCurrency(initialSummary.totalLiabilities)}
										</span>
									</div>
									{filteredLiabilities.map((account) => (
										<AccountCard
											key={account.id}
											account={account}
											isSelected={selectedAccount?.id === account.id}
											onClick={() => setSelectedAccount(account)}
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
						/>
					</div>
				</div>
			</PageContent>

			{/* Dialogs */}
			<AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={handleAccountSuccess} />
			<RecordTransactionDialog
				open={transactionDialogOpen}
				onOpenChange={setTransactionDialogOpen}
				account={selectedAccount}
				onSuccess={handleTransactionSuccess}
			/>
		</PageShell>
	);
}
