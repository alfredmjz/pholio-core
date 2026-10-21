"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";

import { BalanceCard } from "./components/BalanceCard";
import { AccountStandingCard } from "./components/AccountStandingCard";
import { PromotionsTrackerCard } from "./components/PromotionsTrackerCard";
import { ContributionRoomCard } from "./components/ContributionRoomCard";
import { QuickActionsCard } from "./components/QuickActionsCard";
import { InsightsCard } from "./components/InsightsCard";
import { PerformanceCard } from "./components/PerformanceCard";
import { NotesCard } from "./components/NotesCard";
import { ActivityCard } from "./components/ActivityCard";
import { OtherAccountsCard } from "./components/OtherAccountsCard";
import { EditAccountDialog } from "./components/EditAccountDialog";
import { AccountTransactionDialog } from "./components/AccountTransactionDialog";

import { deleteAccount, getAccountTransactions, getAccountById } from "../../actions";
import { AccountDetailLoadingSkeleton } from "../../components/account-detail-loading-skeleton";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import { isSampleDataActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";
import type { AccountWithType, AccountTransaction } from "../../types";
import type { AccountContribution } from "@/lib/types/contribution";

interface AccountDetailClientProps {
	accountId: string;
	/** Null in sample-data mode when the account exists only in the browser's demo store. */
	account: AccountWithType | null;
	transactions: AccountTransaction[];
	otherAccounts: AccountWithType[];
	contribution: AccountContribution | null;
}

export function AccountDetailClient({
	accountId,
	account: initialAccount,
	transactions: initialTransactions,
	otherAccounts: serverOtherAccounts,
	contribution,
}: AccountDetailClientProps) {
	const router = useRouter();

	// Sample data (demo session or `dev:mock`): the server only knows the static sample set, so
	// the account, its ledger and the other accounts come from the in-browser demo store, which
	// also holds accounts and transactions created during the session. Resolved after mount
	// because the store lives in sessionStorage.
	const [dataSource, setDataSource] = useState<"pending" | "demo" | "server">("pending");
	useEffect(() => {
		setDataSource(isSampleDataActive() ? "demo" : "server");
	}, []);
	const isDemo = dataSource === "demo";

	const { data: serverAccount, setData: setServerAccount } = useServerSyncedData<AccountWithType | null>(
		initialAccount,
		() => getAccountById(accountId),
		{ refreshOnFocus: dataSource === "server" }
	);
	const { data: serverTransactions, setData: setTransactions } = useServerSyncedData<AccountTransaction[]>(
		initialTransactions,
		() => getAccountTransactions(accountId),
		{ refreshOnFocus: dataSource === "server" }
	);
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

	const demoAccounts = useDemoStore((state) => state.accounts);
	const demoLedger = useDemoStore((state) => state.accountTransactions);
	const demoAccount = useMemo(
		() => demoAccounts.find((acc) => acc.id === accountId) ?? null,
		[demoAccounts, accountId]
	);
	const demoTransactions = useMemo(
		() =>
			demoLedger
				.filter((txn) => txn.account_id === accountId)
				.sort(
					(a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at)
				),
		[demoLedger, accountId]
	);
	const demoOtherAccounts = useMemo(
		() => demoAccounts.filter((acc) => acc.id !== accountId),
		[demoAccounts, accountId]
	);

	const account = isDemo ? demoAccount : serverAccount;
	const transactions = isDemo ? demoTransactions : serverTransactions;
	const otherAccounts = isDemo ? demoOtherAccounts : serverOtherAccounts;
	const setAccount = (updated: AccountWithType) => {
		if (isDemo) useDemoStore.getState().updateAccount(updated);
		else setServerAccount(updated);
	};

	// Dialog states
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
	const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("deposit");
	// When set, the transaction dialog opens as a transfer that settles this liability's debt
	const [payRemainingAmount, setPayRemainingAmount] = useState<number | null>(null);
	const [editTransactionDialogOpen, setEditTransactionDialogOpen] = useState(false);
	const [editingTransaction, setEditingTransaction] = useState<AccountTransaction | null>(null);

	// If the account was deleted (here or in another tab), or is in neither the server data
	// nor the demo store, go back to the balance sheet.
	useEffect(() => {
		if (dataSource !== "pending" && account === null) router.replace("/balancesheet");
	}, [dataSource, account, router]);

	if (!account) return dataSource === "pending" ? <AccountDetailLoadingSkeleton /> : null;

	const accountClass = account.account_type?.class;

	const handleDelete = async () => {
		const success = await deleteAccount(account.id);
		if (success) {
			if (isDemo) useDemoStore.getState().removeAccount(account.id);
			toast.success("Account deleted");
			router.push("/balancesheet");
		} else {
			toast.error("Deletion Failed", {
				description: "Could not delete the account. Please try again.",
			});
		}
	};

	const handleAccountUpdated = (updatedAccount: AccountWithType) => {
		setAccount(updatedAccount);
		if (!isDemo) router.refresh();
	};

	const handleRecordDeposit = () => {
		setPayRemainingAmount(null);
		setTransactionType("deposit");
		setTransactionDialogOpen(true);
	};

	const handleRecordWithdrawal = () => {
		setPayRemainingAmount(null);
		setTransactionType("withdrawal");
		setTransactionDialogOpen(true);
	};

	const handleTransactionSuccess = async () => {
		// Demo: the dialog already recorded the transaction in the store, which this page reads.
		if (isDemo) return;

		// Refresh transactions and account balance
		setIsLoadingTransactions(true);
		try {
			const [txns, updatedAccount] = await Promise.all([
				getAccountTransactions(account.id),
				getAccountById(account.id),
			]);
			setTransactions(txns);
			if (updatedAccount) {
				setServerAccount(updatedAccount);
			}
			router.refresh();
		} finally {
			setIsLoadingTransactions(false);
		}
	};

	const handleTransactionClick = (transaction: AccountTransaction) => {
		setEditingTransaction(transaction);
		setEditTransactionDialogOpen(true);
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-CA", {
			style: "currency",
			currency: account.currency || "CAD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	return (
		<PageShell>
			{/* Header */}
			<PageHeader isSticky={false} className="flex items-center justify-between gap-4">
				<div className="flex min-w-0 items-center gap-4">
					<Link href="/balancesheet">
						<Button variant="ghost" size="icon" className="shrink-0">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div className="min-w-0">
						<h1 className="truncate text-2xl font-bold tracking-tight">{account.name}</h1>
						<p className="truncate text-sm text-primary">
							{account.institution && `${account.institution} • `}
							{account.account_type?.name}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setDeleteDialogOpen(true)}
						className="text-error hover:text-error"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</PageHeader>

			<PageContent>
				{/* Main grid layout - flex for responsiveness */}
				<div className="flex flex-col lg:flex-row gap-6">
					{/* Left Column - Main Content */}
					<div className="flex-1 flex flex-col gap-6 min-w-0">
						{/* Balance Card */}
						<BalanceCard account={account} accountClass={accountClass} formatCurrency={formatCurrency} />

						{/* Account Standing Card (Debt & Payment validation summary) */}
						<AccountStandingCard
							account={account}
							transactions={transactions}
							formatCurrency={formatCurrency}
							onPayRemaining={(amount) => {
								// Settle the debt as a transfer from a source account into this
								// liability account, pre-filled with the outstanding amount.
								setPayRemainingAmount(amount);
								setTransactionDialogOpen(true);
							}}
						/>

						{/* Investment deposits and contribution room */}
						{(isInvestmentAccount(account) || account.track_contribution_room) && (
							<ContributionRoomCard account={account} contribution={contribution} />
						)}

						{/* Welcome Bonuses & Promotions Tracker */}
						<PromotionsTrackerCard accountId={account.id} formatCurrency={formatCurrency} />

						{/* Insights Card */}
						<InsightsCard
							account={account}
							transactions={transactions}
							accountClass={accountClass}
							formatCurrency={formatCurrency}
						/>

						{/* Activity Card */}
						<ActivityCard
							transactions={transactions}
							isLoading={isLoadingTransactions}
							isLiability={accountClass === "liability"}
							formatCurrency={formatCurrency}
							onTransactionClick={handleTransactionClick}
						/>
					</div>

					{/* Right Column - Sidebar */}
					<div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
						{/* Quick Actions */}
						<QuickActionsCard
							isLiability={accountClass === "liability"}
							onAddDeposit={handleRecordDeposit}
							onRecordWithdrawal={handleRecordWithdrawal}
							onEditDetails={() => setEditDialogOpen(true)}
						/>

						{/* Performance */}
						<PerformanceCard account={account} transactions={transactions} formatCurrency={formatCurrency} />

						{/* Notes */}
						<NotesCard account={account} onAccountUpdated={handleAccountUpdated} />

						{/* Other Accounts */}
						<OtherAccountsCard accounts={otherAccounts} />
					</div>
				</div>
			</PageContent>

			{/* Dialogs */}
			<EditAccountDialog
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				account={account}
				onSuccess={handleAccountUpdated}
			/>

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete Account"
				description={`Are you sure you want to delete "${account.name}"? This action cannot be undone.`}
				onConfirm={handleDelete}
			/>

			<UnifiedTransactionDialog
				open={transactionDialogOpen}
				onOpenChange={(open) => {
					setTransactionDialogOpen(open);
					if (!open) setPayRemainingAmount(null);
				}}
				categories={[]}
				// Every account is selectable so transfers can come from, or go to, any other account;
				// this account stays the default.
				accounts={[account, ...otherAccounts]}
				defaultAccountId={account.id}
				defaultToAccountId={payRemainingAmount !== null ? account.id : undefined}
				defaultAmount={payRemainingAmount ?? undefined}
				defaultType={payRemainingAmount !== null ? "transfer" : transactionType === "deposit" ? "income" : "expense"}
				onSuccess={handleTransactionSuccess}
				context="balancesheet"
			/>

			<AccountTransactionDialog
				open={editTransactionDialogOpen}
				onOpenChange={setEditTransactionDialogOpen}
				transaction={editingTransaction}
				onSuccess={handleTransactionSuccess}
			/>
		</PageShell>
	);
}
