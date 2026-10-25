"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, MoreHorizontal, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SurfacePage } from "@/components/layout/surface-page";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";

import { BalanceHero } from "./components/balance-hero";
import { PromotionsTrackerCard } from "./components/PromotionsTrackerCard";
import { ContributionRoomCard } from "./components/ContributionRoomCard";
import { InsightsCard } from "./components/InsightsCard";
import { PerformanceCard } from "./components/PerformanceCard";
import { NotesCard } from "./components/NotesCard";
import { ActivityCard } from "./components/ActivityCard";
import { OtherAccountsCard } from "./components/OtherAccountsCard";
import { EditAccountDialog } from "./components/EditAccountDialog";
import { AccountTransactionDialog } from "./components/AccountTransactionDialog";

import { deleteAccount, getAccountTransactions, getAccountById } from "../actions";
import { AccountDetailLoadingSkeleton } from "../components/account-detail-loading-skeleton";
import { TYPE_ICON } from "../components/account-row";
import { sparklinePoints, type BalancePoint } from "../account-insights";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { cn } from "@/lib/utils";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import { isSampleDataActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";
import type { AccountTypeCode, AccountWithType, AccountTransaction } from "../types";
import type { AccountContribution } from "@/lib/types/contribution";
import { formatMoney } from "@/lib/format";
import { useFormatSettings } from "@/components/providers/format-provider";

interface AccountDetailClientProps {
	accountId: string;
	/** Null in sample-data mode when the account exists only in the browser's demo store. */
	account: AccountWithType | null;
	transactions: AccountTransaction[];
	otherAccounts: AccountWithType[];
	contribution: AccountContribution | null;
	/** Recorded balances, oldest first; today's balance is appended on the client. */
	history: BalancePoint[];
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
}

export function AccountDetailClient({
	accountId,
	account: initialAccount,
	transactions: initialTransactions,
	otherAccounts: serverOtherAccounts,
	contribution,
	history,
	today,
}: AccountDetailClientProps) {
	useFormatSettings();
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
	// nor the demo store, go back to the accounts list.
	useEffect(() => {
		if (dataSource !== "pending" && account === null) router.replace("/accounts");
	}, [dataSource, account, router]);

	if (!account) return dataSource === "pending" ? <AccountDetailLoadingSkeleton /> : null;

	const accountClass = account.account_type?.class;

	const handleDelete = async () => {
		const success = await deleteAccount(account.id);
		if (success) {
			if (isDemo) useDemoStore.getState().removeAccount(account.id);
			toast.success("Account deleted");
			router.push("/accounts");
		} else {
			toast.error("Couldn't delete the account", {
				description: "Try again in a moment.",
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

	const formatCurrency = (amount: number) => formatMoney(amount, { showCents: true });

	const isLiability = accountClass === "liability";
	const TypeIcon = TYPE_ICON[(account.account_type?.code as AccountTypeCode) ?? "other"] ?? Wallet;
	const balanceHistory = sparklinePoints(history, Number(account.current_balance), today);

	return (
		<SurfacePage>
			<header className="flex flex-col gap-4">
				<Link
					href="/accounts"
					className="type-body-sm inline-flex w-fit items-center gap-1.5 rounded-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden />
					Accounts
				</Link>
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3.5">
						<span
							className={cn(
								"flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
								isLiability ? "bg-error-muted text-error" : "bg-card-muted text-primary"
							)}
							aria-hidden
						>
							<TypeIcon className="h-5 w-5" />
						</span>
						<div className="min-w-0">
							<h1 className="type-h2 truncate text-primary">{account.name}</h1>
							<p className="type-body truncate text-muted-foreground">
								{[account.institution, account.account_type?.name].filter(Boolean).join(", ")}
							</p>
						</div>
					</div>
					<div className="flex w-full items-center gap-2 sm:w-auto">
						<Button
							onClick={handleRecordDeposit}
							className="h-10 min-w-0 flex-1 gap-2 rounded-full px-3 sm:flex-none sm:pl-3.5 sm:pr-4"
						>
							<Plus className="hidden h-4 w-4 sm:block" aria-hidden />
							{isLiability ? "Record Payment" : "Add Deposit"}
						</Button>
						<Button
							variant="outline"
							onClick={handleRecordWithdrawal}
							className="h-10 min-w-0 flex-1 gap-2 rounded-full px-3 sm:flex-none sm:pl-3.5 sm:pr-4"
						>
							<Minus className="hidden h-4 w-4 sm:block" aria-hidden />
							{isLiability ? "Record Charge" : "Record Withdrawal"}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-primary"
									aria-label={`More actions for ${account.name}`}
								>
									<MoreHorizontal className="h-5 w-5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setEditDialogOpen(true)}>Edit details</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem className="text-error" onClick={() => setDeleteDialogOpen(true)}>
									Delete account
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			<BalanceHero
				account={account}
				transactions={transactions}
				history={balanceHistory}
				formatCurrency={formatCurrency}
				onPayRemaining={(amount) => {
					// Settle the debt as a transfer from a source account into this
					// liability account, pre-filled with the outstanding amount.
					setPayRemainingAmount(amount);
					setTransactionDialogOpen(true);
				}}
			/>

			{/* The wide column holds what people read and write (activity, promotions, notes); the
			    narrow one holds short facts. Two columns only from xl, so the side never squeezes. */}
			<div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
				<div className="flex min-w-0 flex-col gap-5 lg:gap-6">
					{(isInvestmentAccount(account) || account.track_contribution_room) && (
						<ContributionRoomCard account={account} contribution={contribution} />
					)}
					<InsightsCard
						account={account}
						transactions={transactions}
						accountClass={accountClass}
						formatCurrency={formatCurrency}
					/>
					<ActivityCard
						transactions={transactions}
						isLoading={isLoadingTransactions}
						isLiability={isLiability}
						formatCurrency={formatCurrency}
						onTransactionClick={handleTransactionClick}
					/>
					<PromotionsTrackerCard accountId={account.id} formatCurrency={formatCurrency} />
					<NotesCard account={account} onAccountUpdated={handleAccountUpdated} />
				</div>

				<div className="flex min-w-0 flex-col gap-5 lg:gap-6">
					<PerformanceCard account={account} transactions={transactions} formatCurrency={formatCurrency} />
					<OtherAccountsCard accounts={otherAccounts} />
				</div>
			</div>

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
				title="Delete account"
				description={`Delete "${account.name}" and its history? This can't be undone.`}
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
				context="accounts"
			/>

			<AccountTransactionDialog
				open={editTransactionDialogOpen}
				onOpenChange={setEditTransactionDialogOpen}
				transaction={editingTransaction}
				onSuccess={handleTransactionSuccess}
			/>
		</SurfacePage>
	);
}
