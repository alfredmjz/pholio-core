"use client";

import { CheckCircle2, TrendingUp } from "lucide-react";
import { SurfaceSection } from "@/components/layout/surface-section";
import { parseLocalDate } from "@/lib/date-utils";
import type { AccountWithType, AccountTransaction } from "../../types";
import { getFieldVisibility } from "../../field-visibility";
import { formatDateParts } from "@/lib/format";

interface InsightsCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
}

export function InsightsCard({ account, transactions, accountClass, formatCurrency }: InsightsCardProps) {
	const visibility = getFieldVisibility(account.account_type, account.field_visibility);
	const isLiability = accountClass === "liability";

	const goalValue = visibility.showOriginalAmount
		? account.original_amount
		: visibility.showTargetGoal
			? account.target_balance
			: null;

	// Investments show no growth split: their balance is what was deposited, not market value.
	// 1. Loans -> principal vs. interest paid
	if (isLiability && visibility.showOriginalAmount && account.original_amount) {
		return (
			<LoanComposition
				account={account}
				transactions={transactions}
				goalValue={account.original_amount}
				formatCurrency={formatCurrency}
			/>
		);
	}

	// 2. Savings, payoffs and other goals -> when the goal will be reached at the current pace
	if (goalValue && goalValue > 0) {
		return (
			<GoalTimelineProjection
				transactions={transactions}
				formatCurrency={formatCurrency}
				goalValue={goalValue}
				currentAmount={account.current_balance}
				isLiability={isLiability}
			/>
		);
	}

	// Everyday accounts without a goal have nothing to project.
	return null;
}

// ============================================================================
// Internal chart components
// ============================================================================

interface GoalTimelineProjectionProps {
	transactions: AccountTransaction[];
	goalValue: number;
	currentAmount: number;
	isLiability: boolean;
	formatCurrency: (amount: number) => string;
}

function GoalTimelineProjection({
	transactions,
	goalValue,
	currentAmount,
	isLiability,
	formatCurrency,
}: GoalTimelineProjectionProps) {
	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
	const recentTx = transactions.filter((t) => parseLocalDate(t.transaction_date) >= sixMonthsAgo);

	let netFlow = 0;
	recentTx.forEach((t) => {
		if (t.transaction_type === "withdrawal" || t.transaction_type === "payment") {
			netFlow -= t.amount;
		} else {
			netFlow += t.amount;
		}
	});

	const avgMonthlyFlow = netFlow / 6;
	const progressingFlow = isLiability ? -avgMonthlyFlow : avgMonthlyFlow;
	const remainingToGoal = isLiability ? currentAmount : Math.max(goalValue - currentAmount, 0);

	let monthsToGoal: number | null = null;
	let targetDate: Date | null = null;

	if (progressingFlow > 0 && remainingToGoal > 0) {
		monthsToGoal = Math.ceil(remainingToGoal / progressingFlow);
		targetDate = new Date(now.getFullYear(), now.getMonth() + monthsToGoal, 1);
	}

	const isDone = isLiability ? currentAmount <= 0 : currentAmount >= goalValue;

	return (
		<SurfaceSection
			id="insight-heading"
			title={isLiability ? "Payoff timeline" : "Goal timeline"}
			note="Based on your average over the last 6 months"
		>
			{isDone ? (
				<p className="type-body flex items-center gap-2 text-success">
					<CheckCircle2 className="h-5 w-5" aria-hidden />
					{isLiability ? "Paid off. Nothing left to project." : "Goal reached. Nice work."}
				</p>
			) : monthsToGoal && targetDate ? (
				<div className="flex flex-col gap-5">
					<dl className="grid grid-cols-2 gap-4">
						<div>
							<dt className="type-body-xs text-muted-foreground">Time left</dt>
							<dd className="type-stat mt-1 text-primary">
								{monthsToGoal} {monthsToGoal === 1 ? "month" : "months"}
							</dd>
						</div>
						<div>
							<dt className="type-body-xs text-muted-foreground">{isLiability ? "Paid off by" : "Reached by"}</dt>
							<dd className="type-stat mt-1 text-primary">
								{formatDateParts(targetDate, { month: "long", year: "numeric" })}
							</dd>
						</div>
					</dl>
					<p className="type-body-sm flex items-start gap-2 text-muted-foreground">
						<TrendingUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
						<span>
							You {isLiability ? "pay down" : "add"} about{" "}
							<span className="font-medium text-primary">{formatCurrency(progressingFlow)}</span> a month.
						</span>
					</p>
				</div>
			) : (
				<p className="type-body-sm text-muted-foreground">
					{isLiability
						? "Record a few months of payments and this will estimate when the balance hits zero."
						: "Add to this account for a few months and this will estimate when you reach the goal."}
				</p>
			)}
		</SurfaceSection>
	);
}

interface CompositionProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

function LoanComposition({
	account,
	transactions,
	goalValue,
	formatCurrency,
}: CompositionProps & { goalValue: number }) {
	const interestPaid = transactions
		.filter((t) => t.transaction_type === "interest")
		.reduce((sum, t) => sum + Math.abs(t.amount), 0);

	const principalPaid = Math.max(goalValue - account.current_balance, 0);
	const totalPaid = interestPaid + principalPaid;

	const principalPercent = totalPaid > 0 ? (principalPaid / totalPaid) * 100 : 0;
	const interestPercent = totalPaid > 0 ? (interestPaid / totalPaid) * 100 : 0;

	return (
		<SurfaceSection
			id="insight-heading"
			title="Where payments went"
			note={totalPaid > 0 ? `${formatCurrency(totalPaid)} paid so far` : undefined}
		>
			{totalPaid > 0 ? (
				<div className="flex flex-col gap-5">
					<div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-primary/[0.07]" aria-hidden>
						<div className="h-full rounded-full bg-primary/75" style={{ width: `${principalPercent}%` }} />
						<div className="h-full rounded-full bg-error" style={{ width: `${interestPercent}%` }} />
					</div>
					<dl className="grid grid-cols-2 gap-4">
						<div>
							<dt className="type-body-xs flex items-center gap-2 text-muted-foreground">
								<span className="h-2.5 w-2.5 rounded-full bg-primary/75" aria-hidden />
								Principal
							</dt>
							<dd className="type-stat mt-1 text-primary">{formatCurrency(principalPaid)}</dd>
						</div>
						<div>
							<dt className="type-body-xs flex items-center gap-2 text-muted-foreground">
								<span className="h-2.5 w-2.5 rounded-full bg-error" aria-hidden />
								Interest
							</dt>
							<dd className="type-stat mt-1 text-error">{formatCurrency(interestPaid)}</dd>
						</div>
					</dl>
				</div>
			) : (
				<p className="type-body-sm text-muted-foreground">
					No payments recorded yet. Once you pay, this splits them into principal and interest.
				</p>
			)}
		</SurfaceSection>
	);
}
