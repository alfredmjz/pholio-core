"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, DollarSign, RefreshCw } from "lucide-react";
import { SurfaceSection } from "@/components/layout/surface-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/lib/date-utils";
import { transferDirection } from "@/lib/account-links";
import type { AccountTransaction } from "../../types";

interface ActivityCardProps {
	transactions: AccountTransaction[];
	isLoading: boolean;
	isLiability?: boolean;
	formatCurrency: (amount: number) => string;
	onTransactionClick?: (transaction: AccountTransaction) => void;
}

const PREVIEW_COUNT = 8;

// A transfer lowers the balance or debt when its amount is negative: money out of an asset, or a
// payment into a liability.
const isOutflow = (txn: AccountTransaction) =>
	txn.transaction_type === "withdrawal" ||
	txn.transaction_type === "payment" ||
	(txn.transaction_type === "transfer" && txn.amount < 0);

function TransactionIcon({ type }: { type: string }) {
	switch (type) {
		case "deposit":
		case "contribution":
		case "refund":
			return <ArrowUpRight className="h-4 w-4 text-success" />;
		case "withdrawal":
		case "payment":
			return <ArrowDownLeft className="h-4 w-4 text-error" />;
		case "adjustment":
		case "transfer":
			return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
		default:
			return <DollarSign className="h-4 w-4 text-accent" />;
	}
}

const getTransactionTitle = (txn: AccountTransaction, isLiability: boolean) => {
	// On a liability, an adjustment recorded through the transaction dialog (it has a budget row)
	// is a purchase that adds to the debt; balance adjustments have no budget row.
	if (isLiability && txn.transaction_type === "adjustment" && txn.linked_allocation_transaction_id) {
		return "Purchase / Charge";
	}

	switch (txn.transaction_type) {
		case "deposit":
			return "Deposit";
		case "contribution":
			return "Contribution";
		case "withdrawal":
			return "Withdrawal";
		case "payment":
			return "Payment";
		case "interest":
			return "Interest";
		case "refund":
			return "Refund";
		case "adjustment":
			return "Balance adjustment";
		case "transfer":
			return txn.transfer_account
				? `Transfer ${transferDirection(txn.amount, isLiability)} ${txn.transfer_account.label}`
				: "Transfer";
		default:
			return "Transaction";
	}
};

/** This account's ledger, newest first. Clicking a row opens it for editing. */
export function ActivityCard({
	transactions,
	isLoading,
	isLiability = false,
	formatCurrency,
	onTransactionClick,
}: ActivityCardProps) {
	const [showAll, setShowAll] = useState(false);
	const shown = showAll ? transactions : transactions.slice(0, PREVIEW_COUNT);

	return (
		<SurfaceSection
			id="activity-heading"
			title="Activity"
			note={
				transactions.length > 0
					? `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"}, newest first`
					: undefined
			}
		>
			{isLoading && transactions.length === 0 ? (
				<div className="flex flex-col gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="flex items-center gap-3">
							<Skeleton className="h-8 w-8 rounded-full" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 w-20" />
						</div>
					))}
				</div>
			) : transactions.length === 0 ? (
				<p className="type-body-sm text-muted-foreground">
					Nothing recorded yet. Deposits, payments and transfers on this account will show up here.
				</p>
			) : (
				<>
					<ul className={cn("-mx-2 flex flex-col divide-y divide-border/50", isLoading && "opacity-60")}>
						{shown.map((txn) => (
							<li key={txn.id}>
								<button
									type="button"
									onClick={() => onTransactionClick?.(txn)}
									className="row-interactive flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left"
								>
									<span
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-muted"
										aria-hidden
									>
										<TransactionIcon type={txn.transaction_type} />
									</span>
									<span className="min-w-0 flex-1">
										<span className="type-body-sm block truncate font-medium text-primary">
											{txn.description || getTransactionTitle(txn, isLiability)}
										</span>
										<span className="type-body-xs block truncate text-muted-foreground">
											{txn.description ? `${getTransactionTitle(txn, isLiability)}, ` : ""}
											{formatFullDate(txn.transaction_date)}
										</span>
									</span>
									<span className={cn("type-value shrink-0", isOutflow(txn) ? "text-primary" : "text-success")}>
										{isOutflow(txn) ? "-" : "+"}
										{formatCurrency(Math.abs(txn.amount))}
									</span>
								</button>
							</li>
						))}
					</ul>
					{transactions.length > PREVIEW_COUNT && (
						<Button variant="ghost" size="sm" className="mt-2 rounded-full" onClick={() => setShowAll((v) => !v)}>
							{showAll ? "Show less" : `Show all ${transactions.length}`}
						</Button>
					)}
				</>
			)}
		</SurfaceSection>
	);
}
