"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";

import { BalanceCard } from "./components/BalanceCard";
import { QuickActionsCard } from "./components/QuickActionsCard";
import { InsightsCard } from "./components/InsightsCard";
import { PerformanceCard } from "./components/PerformanceCard";
import { NotesCard } from "./components/NotesCard";
import { ActivityCard } from "./components/ActivityCard";
import { OtherAccountsCard } from "./components/OtherAccountsCard";
import { EditAccountDialog } from "./components/EditAccountDialog";

import { deleteAccount, getAccountTransactions } from "../../actions";
import type { AccountWithType, AccountTransaction } from "../../types";

interface AccountDetailClientProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	otherAccounts: AccountWithType[];
}

export function AccountDetailClient({
	account: initialAccount,
	transactions: initialTransactions,
	otherAccounts,
}: AccountDetailClientProps) {
	const router = useRouter();
	const [account, setAccount] = useState(initialAccount);
	const [transactions, setTransactions] = useState(initialTransactions);
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

	// Dialog states
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
	const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("deposit");

	const accountClass = account.account_type?.class;

	const handleDelete = async () => {
		const success = await deleteAccount(account.id);
		if (success) {
			toast.success("Account deleted");
			router.push("/balancesheet");
		} else {
			toast.error("Failed to delete account");
		}
	};

	const handleAccountUpdated = (updatedAccount: AccountWithType) => {
		setAccount(updatedAccount);
		router.refresh();
	};

	const handleRecordDeposit = () => {
		setTransactionType("deposit");
		setTransactionDialogOpen(true);
	};

	const handleRecordWithdrawal = () => {
		setTransactionType("withdrawal");
		setTransactionDialogOpen(true);
	};

	const handleTransactionSuccess = async () => {
		// Refresh transactions
		setIsLoadingTransactions(true);
		try {
			const txns = await getAccountTransactions(account.id);
			setTransactions(txns);
			router.refresh();
		} finally {
			setIsLoadingTransactions(false);
		}
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
				<div className="flex items-center gap-4">
					<Link href="/balancesheet">
						<Button variant="ghost" size="icon" className="shrink-0">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
						<p className="text-sm text-muted-foreground">
							{account.institution} • {account.account_type?.name}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
						<Edit className="h-4 w-4 mr-2" />
						Edit
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setDeleteDialogOpen(true)}
						className="text-destructive hover:text-destructive"
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
							accountClass={accountClass}
							formatCurrency={formatCurrency}
							onRecordTransaction={handleRecordDeposit}
						/>
					</div>

					{/* Right Column - Sidebar */}
					<div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
						{/* Quick Actions */}
						<QuickActionsCard
							onAddDeposit={handleRecordDeposit}
							onRecordWithdrawal={handleRecordWithdrawal}
							onEditDetails={() => setEditDialogOpen(true)}
						/>

						{/* Performance */}
						<PerformanceCard account={account} transactions={transactions} formatCurrency={formatCurrency} />

						{/* Notes */}
						<NotesCard account={account} onAccountUpdated={handleAccountUpdated} />

						{/* Other Accounts */}
						<OtherAccountsCard accounts={otherAccounts} currentAccountClass={accountClass} />
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
				onOpenChange={setTransactionDialogOpen}
				categories={[]}
				accounts={[account]}
				defaultAccountId={account.id}
				onSuccess={handleTransactionSuccess}
				context="balancesheet"
			/>
		</PageShell>
	);
}
