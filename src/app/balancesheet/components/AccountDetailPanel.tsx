"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Trash2, Plus, Building2, ArrowUpRight, ArrowDownRight, Wallet, CreditCard } from "lucide-react";
import { AccountWithType, AccountTransaction } from "../types";
import { cn } from "@/lib/utils";

interface AccountDetailPanelProps {
	account: AccountWithType | null;
	transactions: AccountTransaction[];
	isLoadingTransactions?: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onRecordTransaction: () => void;
}

// Health status type
type HealthStatus = {
	label: string;
	emoji: string;
	variant: "default" | "secondary" | "destructive" | "outline";
	description: string;
};

// Get account health based on progress
const getAccountHealth = (
	accountClass: "asset" | "liability" | undefined,
	current: number,
	target: number | null
): HealthStatus => {
	if (!target) {
		// No target set
		if (current > 0 && accountClass === "asset") {
			return { label: "Building", emoji: "🌱", variant: "secondary", description: "Growing steadily" };
		}
		return { label: "Tracking", emoji: "📊", variant: "outline", description: "Tracking your balance" };
	}

	const progress = accountClass === "asset" ? (current / target) * 100 : ((target - current) / target) * 100;

	if (progress >= 100) {
		return { label: "Crushing It", emoji: "🚀", variant: "default", description: "Goal exceeded!" };
	} else if (progress >= 75) {
		return { label: "Almost There", emoji: "🔥", variant: "default", description: "75%+ of goal reached" };
	} else if (progress >= 50) {
		return { label: "On Track", emoji: "💪", variant: "secondary", description: "50%+ of goal reached" };
	} else if (progress >= 25) {
		return { label: "Building", emoji: "🌱", variant: "secondary", description: "25%+ of goal reached" };
	} else {
		return { label: "Getting Started", emoji: "🎯", variant: "outline", description: "Just beginning the journey" };
	}
};

export function AccountDetailPanel({
	account,
	transactions,
	isLoadingTransactions = false,
	onEdit,
	onDelete,
	onRecordTransaction,
}: AccountDetailPanelProps) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
		}).format(amount);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const getTransactionTypeLabel = (type: string) => {
		const labels: Record<string, string> = {
			deposit: "Deposit",
			withdrawal: "Withdrawal",
			payment: "Payment",
			interest: "Interest",
			adjustment: "Adjustment",
		};
		return labels[type] || type;
	};

	const getTransactionSign = (type: string, accountType: string) => {
		if (accountType === "asset") {
			return type === "deposit" ? "+" : "-";
		} else {
			return type === "payment" ? "-" : "+";
		}
	};

	if (!account) {
		return (
			<Card className="h-full flex items-center justify-center text-center p-12">
				<div className="max-w-sm flex flex-col items-center gap-4">
					<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
						<Building2 className="h-8 w-8 text-muted-foreground" />
					</div>
					<div className="flex flex-col gap-2">
						<h3 className="text-lg font-semibold">No Account Selected</h3>
						<p className="text-sm text-muted-foreground">
							Select an account from the sidebar to view details and transactions
						</p>
					</div>
				</div>
			</Card>
		);
	}

	const accountClass = account.account_type?.class;
	const progress =
		account.target_balance && accountClass === "asset"
			? (account.current_balance / account.target_balance) * 100
			: account.target_balance && accountClass === "liability"
				? ((account.target_balance - account.current_balance) / account.target_balance) * 100
				: null;

	const health = getAccountHealth(accountClass, account.current_balance, account.target_balance);

	// Calculate this month's contribution
	const currentDate = new Date();
	const currentMonth = currentDate.getMonth();
	const currentYear = currentDate.getFullYear();

	const currentMonthTransactions = transactions.filter((txn) => {
		const txnDate = new Date(txn.transaction_date);
		return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
	});

	const monthlyContribution = currentMonthTransactions.reduce((sum, txn) => {
		if (accountClass === "asset") {
			// For assets: deposits/interest add, withdrawals subtract
			if (
				txn.transaction_type === "deposit" ||
				txn.transaction_type === "interest" ||
				txn.transaction_type === "contribution"
			) {
				return sum + txn.amount;
			} else if (txn.transaction_type === "withdrawal") {
				return sum - txn.amount;
			}
		} else {
			// For liabilities: payments reduce debt (positive contribution), charges increase debt (negative contribution)
			if (txn.transaction_type === "payment") {
				return sum + txn.amount;
			} else if (txn.transaction_type === "deposit" || txn.transaction_type === "interest") {
				return sum - txn.amount;
			}
		}
		return sum;
	}, 0);

	// Transaction skeleton for loading state
	const TransactionSkeleton = () => (
		<div className="flex flex-col gap-2">
			{[1, 2, 3].map((i) => (
				<div key={i} className="flex items-center justify-between p-3 rounded-lg border animate-pulse">
					<div className="flex-1 flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<div className="h-4 w-20 bg-muted rounded" />
							<div className="h-5 w-16 bg-muted rounded" />
						</div>
						<div className="h-4 w-32 bg-muted rounded" />
					</div>
					<div className="h-6 w-20 bg-muted rounded" />
				</div>
			))}
		</div>
	);

	return (
		<TooltipProvider>
			<Card className="h-full flex flex-col overflow-hidden border-none shadow-lg">
				{/* Header Section */}
				<div className="flex flex-col gap-6 p-6">
					{/* Identity Row: Avatar + Title + Actions */}
					<div className="flex items-start gap-4">
						{/* Avatar with Icon */}
						<Avatar
							className={cn(
								"h-14 w-14 text-2xl",
								accountClass === "asset" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
							)}
						>
							<AvatarFallback
								className={cn(
									"text-2xl",
									accountClass === "asset"
										? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
										: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
								)}
							>
								{account.icon || (accountClass === "asset" ? "💰" : "💳")}
							</AvatarFallback>
						</Avatar>

						{/* Title + Subtitle + Health */}
						<div className="flex-1 flex flex-col gap-1">
							<div className="flex items-center gap-3 flex-wrap">
								<h2 className="text-2xl font-bold tracking-tight">{account.name}</h2>
								<Badge variant="outline" className="capitalize">
									{account.account_type?.name}
								</Badge>
								<Tooltip>
									<TooltipTrigger asChild>
										<Badge variant={health.variant} className="cursor-help">
											{health.emoji} {health.label}
										</Badge>
									</TooltipTrigger>
									<TooltipContent>
										<p>{health.description}</p>
									</TooltipContent>
								</Tooltip>
							</div>
							{account.institution && (
								<div className="text-sm text-muted-foreground flex items-center gap-1.5">
									<Building2 className="h-3.5 w-3.5" />
									{account.institution}
								</div>
							)}
						</div>

						{/* Actions */}
						<div className="flex items-center gap-1">
							<Button variant="ghost" size="icon" onClick={onEdit}>
								<Edit className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<Separator />

					{/* Stats Row */}
					<div className="flex items-start gap-8 flex-wrap">
						{/* Current Balance */}
						<div className="flex flex-col gap-1">
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Current Balance
							</span>
							<div
								className={cn(
									"text-3xl font-bold tracking-tight",
									accountClass === "asset" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
								)}
							>
								{formatCurrency(account.current_balance)}
							</div>
							{account.interest_rate && (
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<Badge variant="secondary" className="text-xs">
										APY
									</Badge>
									<span>{(account.interest_rate * 100).toFixed(2)}%</span>
								</div>
							)}
						</div>

						{/* Target / Goal with Enhanced Progress */}
						{account.target_balance && (
							<div className="flex flex-col gap-2 flex-1 min-w-[200px]">
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
										{accountClass === "asset" ? "Target Goal" : "Original Loan"}
									</span>
									<span className="text-sm font-medium text-muted-foreground">
										{formatCurrency(account.target_balance)}
									</span>
								</div>
								{progress !== null && (
									<div className="flex flex-col gap-2 relative mt-4">
										{/* Progress Bar Container */}
										<div className="relative">
											<Progress
												value={Math.min(progress, 100)}
												className={cn("h-3", accountClass === "asset" ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
											/>

											{/* Dynamic Health Indicator on the tip */}
											<div
												className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out z-10"
												style={{
													left: `${Math.min(progress, 100)}%`,
												}}
											>
												<div className="relative group flex items-center justify-center">
													{/* Realistic Burning Flame Effect */}
													{progress > 0 && (
														<div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-visible">
															{/* Core Flame */}
															<div
																className={cn(
																	"absolute  rounded-full blur-md transition-all duration-500 bg-success/70",
																	progress < 25
																		? "h-10 w-8"
																		: progress < 50
																			? "h-12 w-10"
																			: progress < 75
																				? "h-14 w-12"
																				: "h-16 w-14 brightness-125"
																)}
															/>

															{/* Inner Heat (White/Yellow core for high progress) */}
															{progress >= 75 && (
																<div className="absolute left-1/2 bottom-1 -translate-x-1/2 w-4 h-8 bg-white/40 rounded-full blur-sm animate-pulse" />
															)}
														</div>
													)}

													{/* Icon Badge - Circle that expands */}
													<div
														className={cn(
															"relative z-10 flex items-center justify-center rounded-full shadow-md cursor-help transition-all duration-300 ease-out bg-primary text-background overflow-hidden", // Sizing & Expansion
															"w-8 h-8 p-0 group-hover:w-auto group-hover:px-3 group-hover:gap-2",
															progress >= 75 && "scale-110"
														)}
													>
														<span className="text-base flex-shrink-0 leading-none">
															{progress == 0
																? "🌱"
																: progress < 25
																	? "🚶"
																	: progress < 50
																		? "🚲"
																		: progress < 75
																			? "✈️"
																			: "🚀"}
														</span>
														<span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-[10px] font-bold overflow-hidden">
															{Math.min(progress, 100).toFixed(0)}%
														</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Notes */}
					{account.notes && (
						<div className="p-4 bg-muted/30 rounded-lg">
							<span className="text-sm text-muted-foreground italic">{account.notes}</span>
						</div>
					)}
				</div>

				<Separator />

				{/* Transaction History */}
				<div className="flex-1 flex flex-col">
					<div className="flex items-center justify-between p-6 pb-4">
						<h3 className="text-lg font-semibold flex items-center gap-2">
							Transaction History
							<Badge variant="secondary" className="rounded-full px-2 py-0.5 h-auto text-xs font-normal">
								{transactions.length}
							</Badge>
						</h3>
						<Button size="sm" onClick={onRecordTransaction}>
							<Plus className="h-4 w-4" />
							{accountClass === "asset" ? "Add Deposit" : "Record Payment"}
						</Button>
					</div>

					<div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-3">
						{isLoadingTransactions ? (
							<TransactionSkeleton />
						) : transactions.length === 0 ? (
							<div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-xl border-muted-foreground/20 gap-3">
								<div className="p-4 rounded-full bg-muted">
									<Plus className="h-6 w-6 text-muted-foreground" />
								</div>
								<p className="font-medium">No transactions yet</p>
								<p className="text-sm text-muted-foreground">Record your first transaction to get started</p>
							</div>
						) : (
							transactions.map((txn) => (
								<div
									key={txn.id}
									className="group flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm transition-all hover:shadow-md hover:border-primary/20"
								>
									<div className="flex items-center gap-4">
										<div
											className={cn(
												"p-2.5 rounded-lg",
												getTransactionSign(txn.transaction_type, accountClass || "asset") === "+"
													? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
													: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
											)}
										>
											{getTransactionSign(txn.transaction_type, accountClass || "asset") === "+" ? (
												<ArrowUpRight className="h-4 w-4" />
											) : (
												<ArrowDownRight className="h-4 w-4" />
											)}
										</div>
										<div className="flex flex-col gap-0.5">
											<p className="font-medium text-sm">
												{txn.description || getTransactionTypeLabel(txn.transaction_type)}
											</p>
											<p className="text-xs text-muted-foreground">{formatDate(txn.transaction_date)}</p>
										</div>
									</div>

									<div className="text-right flex flex-col gap-1 items-end">
										<div
											className={cn(
												"font-bold",
												getTransactionSign(txn.transaction_type, accountClass || "asset") === "+"
													? "text-green-600 dark:text-green-400"
													: "text-red-600 dark:text-red-400"
											)}
										>
											{getTransactionSign(txn.transaction_type, accountClass || "asset")}
											{formatCurrency(txn.amount)}
										</div>
										<Badge
											variant="secondary"
											className="text-[10px] h-5 px-1.5 font-normal opacity-0 group-hover:opacity-100 transition-opacity"
										>
											{getTransactionTypeLabel(txn.transaction_type)}
										</Badge>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</Card>
		</TooltipProvider>
	);
}
