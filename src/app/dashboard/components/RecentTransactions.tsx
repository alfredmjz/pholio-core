'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/app/dashboard/utils';
import { ArrowRight, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import type { Transaction } from '../types';

interface RecentTransactionsProps {
	transactions: Transaction[];
	onViewAll?: () => void;
	loading?: boolean;
	className?: string;
}

export function RecentTransactions({ transactions, onViewAll, loading = false, className }: RecentTransactionsProps) {
	if (loading) {
		return <RecentTransactionsSkeleton className={className} />;
	}

	return (
		<Card className={cn('p-6 bg-card border border-border', className)}>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
				{onViewAll && (
					<Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs gap-1">
						View All
						<ArrowRight className="h-3.5 w-3.5" />
					</Button>
				)}
			</div>

			{/* Transaction List */}
			{transactions.length > 0 ? (
				<div className="space-y-2">
					{transactions.map((transaction) => (
						<TransactionRow key={transaction.id} transaction={transaction} />
					))}
				</div>
			) : (
				<EmptyState />
			)}
		</Card>
	);
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
	const isIncome = transaction.type === 'income';

	return (
		<div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors duration-150 cursor-pointer">
			{/* Left: Icon + Info */}
			<div className="flex items-center gap-3 min-w-0 flex-1">
				<div className={cn('p-2 rounded-lg flex-shrink-0', isIncome ? 'bg-success-muted' : 'bg-error-muted')}>
					{isIncome ? (
						<ArrowDownLeft className="h-4 w-4 text-success" />
					) : (
						<ArrowUpRight className="h-4 w-4 text-error" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-foreground truncate">{transaction.description}</p>
					<div className="flex items-center gap-2 mt-0.5">
						{transaction.category && (
							<Badge variant="secondary" className="text-xs px-2 py-0 h-5 font-normal">
								{transaction.category}
							</Badge>
						)}
						<span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
					</div>
				</div>
			</div>

			{/* Right: Amount */}
			<span className={cn('text-sm font-semibold flex-shrink-0 ml-3', isIncome ? 'text-success' : 'text-foreground')}>
				{isIncome ? '+' : '-'}
				{formatCurrency(Math.abs(transaction.amount))}
			</span>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="py-12 text-center">
			<div className="inline-flex p-3 rounded-full bg-muted mb-3">
				<Receipt className="h-6 w-6 text-muted-foreground" />
			</div>
			<p className="text-sm font-medium text-foreground mb-1">No recent transactions</p>
			<p className="text-xs text-muted-foreground">Your transaction history will appear here</p>
		</div>
	);
}

export function RecentTransactionsSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn('p-6 bg-card border border-border', className)}>
			<div className="flex items-center justify-between mb-4">
				<div className="h-5 bg-muted rounded w-40 animate-pulse" />
				<div className="h-8 bg-muted rounded w-20 animate-pulse" />
			</div>
			<div className="space-y-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="flex items-center justify-between p-3 animate-pulse">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 bg-muted rounded-lg" />
							<div className="space-y-2">
								<div className="h-3.5 bg-muted rounded w-32" />
								<div className="h-3 bg-muted rounded w-24" />
							</div>
						</div>
						<div className="h-4 bg-muted rounded w-16" />
					</div>
				))}
			</div>
		</Card>
	);
}
