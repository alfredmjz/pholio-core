"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { AccountWithType, AccountTransaction, BalanceSheetSummary } from "./types";
import { NetWorthCard } from "./components/NetWorthCard";
import { DebtRundownCard } from "./components/DebtRundownCard";
import { AssetGrowthCard } from "./components/AssetGrowthCard";
import { RecentActivity } from "./components/RecentActivity";
import { AccountCard } from "./components/AccountCard";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
import { AccountAdjustmentDialog } from "./components/AccountAdjustmentDialog";
import { getAccountTransactions, type RecentActivityItem, reorderAccounts } from "./actions";
import type { AllocationCategory } from "@/app/allocations/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

interface BalanceSheetClientProps {
	initialAccounts: AccountWithType[];
	initialCategories: AllocationCategory[];
	initialActivity: RecentActivityItem[];
	initialSummary: BalanceSheetSummary;
}

export function BalanceSheetClient({
	initialAccounts,
	initialCategories,
	initialActivity,
	initialSummary,
}: BalanceSheetClientProps) {
	const [accounts, setAccounts] = useState<AccountWithType[]>(initialAccounts);
	const router = useRouter();
	const [selectedAccount, setSelectedAccount] = useState<AccountWithType | null>(initialAccounts[0] || null);
	const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(!!(initialAccounts && initialAccounts.length > 0));
	const [searchQuery, setSearchQuery] = useState("");
	const [addDialogOpen, setAddDialogOpen] = useState(false);
	const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
	const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

	// Dnd Sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Transaction cache for optimistic loading
	const transactionCache = useRef<Map<string, AccountTransaction[]>>(new Map());

	const assetAccounts = accounts.filter((acc) => acc.account_type?.class === "asset");
	const liabilityAccounts = accounts.filter((acc) => acc.account_type?.class === "liability");

	// Display accounts based on search, ignoring the strict Asset/Liability split for rendering
	// This allows custom ordering to mix types if desired.
	const displayedAccounts = accounts.filter((acc) => acc.name.toLowerCase().includes(searchQuery.toLowerCase()));

	// Track which accounts we've already started loading to prevent Strict Mode double-loads
	const loadingRef = useRef<Set<string>>(new Set());

	// Load transactions when account is selected
	useEffect(() => {
		if (selectedAccount) {
			const accountId = selectedAccount.id;

			// Prevent duplicate loads from Strict Mode
			if (loadingRef.current.has(accountId)) {
				return;
			}

			const cachedTransactions = transactionCache.current.get(accountId);

			if (cachedTransactions) {
				// If cached, show immediately without loading state
				setTransactions(cachedTransactions);
				setIsLoadingTransactions(false);
				// Don't auto-refresh on initial load - only refresh on explicit user action
			} else {
				// No cache: show loading state and fetch
				loadingRef.current.add(accountId);
				setTransactions([]);
				loadTransactions(accountId);
			}
		}
	}, [selectedAccount]);

	// Background refresh: updates cache silently without loading state
	const refreshTransactionsInBackground = async (accountId: string) => {
		console.log("Refreshing transactions:", accountId);
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

	const loadTransactions = async (accountId: string) => {
		console.log("Loading transactions:", accountId);
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

	// Handlers for drag and drop
	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		console.log("Drag end:", { activeId: active.id, overId: over?.id });

		if (!over || active.id === over.id) {
			console.log("No move needed");
			return;
		}

		// Calculate new order based on current state
		const oldIndex = accounts.findIndex((item) => item.id === active.id);
		const newIndex = accounts.findIndex((item) => item.id === over.id);

		if (oldIndex === -1 || newIndex === -1) {
			return;
		}

		// Optimistic update
		const newOrder = arrayMove(accounts, oldIndex, newIndex);
		setAccounts(newOrder);

		// Persist the new order
		const updates = newOrder.map((acc, index) => ({
			id: acc.id,
			display_order: index,
		}));

		// Fire and forget server action
		reorderAccounts(updates).then((success) => {
			if (!success) {
				toast.error("Failed to save order");
				// Revert on failure if needed, or just show error
			}
		});
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
			previousTotalAssets: initialSummary?.previousTotalAssets,
			previousTotalLiabilities: initialSummary?.previousTotalLiabilities,
			previousNetWorth: initialSummary?.previousNetWorth,
			historicalAssets: initialSummary?.historicalAssets || [],
			historicalLiabilities: initialSummary?.historicalLiabilities || [],
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
					<p className="text-sm text-primary">Track your assets and liabilities</p>
				</div>
				<Button onClick={() => setAddDialogOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
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
						<Card className="lg:col-span-2 flex flex-col bg-card border shadow-sm">
							<div className="p-6 border-border border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
								<div>
									<h2 className="text-xl font-bold">All Accounts</h2>
									<p className="text-sm text-primary">{accounts.length} accounts</p>
								</div>
								<div className="flex items-center gap-2 w-full sm:w-auto">
									<div className="relative flex-1 sm:w-64">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
										<Input
											placeholder="Search..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="bg-background pl-9 h-10"
										/>
									</div>
									<Select defaultValue="all">
										<SelectTrigger className="bg-background w-[120px] h-10">
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

							<div className="flex-1">
								{/* Account Items */}
								<div className="flex flex-col divide-y divide-border">
									<DndContext
										sensors={sensors}
										collisionDetection={closestCenter}
										onDragEnd={handleDragEnd}
										modifiers={[restrictToVerticalAxis]}
									>
										<SortableContext items={displayedAccounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
											{displayedAccounts.map((account) => (
												<AccountCard key={account.id} account={account} />
											))}
										</SortableContext>
									</DndContext>

									{displayedAccounts.length === 0 && (
										<div className="p-12 text-center text-primary">
											<p>{searchQuery ? "No accounts found" : "No accounts yet"}</p>
										</div>
									)}
								</div>
							</div>
						</Card>

						{/* Recent Activity Feed */}
						<div className="lg:col-span-1">
							<RecentActivity activity={initialActivity} />
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
