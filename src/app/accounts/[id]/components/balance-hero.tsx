"use client";

import "@/styles/dashboard.css";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProgressLine } from "@/components/ui/progress-line";
import { formatFullDate } from "@/lib/date-utils";
import { splitMoney } from "@/lib/format";
import { calculateAccountStanding } from "@/lib/account-validation-utils";
import { NetWorthThread } from "@/app/dashboard/components/net-worth-thread";
import type { AccountWithType, AccountTransaction } from "../../types";
import type { BalancePoint } from "../../account-insights";
import { getFieldVisibility } from "../../field-visibility";

interface BalanceHeroProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	/** Recorded balances, oldest first, ending with today's balance. */
	history: BalancePoint[];
	formatCurrency: (amount: number) => string;
	/** Opens a transfer into this liability for what is left to pay. */
	onPayRemaining: (amount: number) => void;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "error" }) {
	return (
		<div className="min-w-0">
			<dt className="type-body-xs text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"type-value mt-0.5",
					tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-primary"
				)}
			>
				{value}
			</dd>
		</div>
	);
}

/**
 * The account's balance as a large figure over its own running thread, with what it can still
 * cover (assets) or what is left to pay (liabilities), and progress toward a goal or payoff.
 */
export function BalanceHero({ account, transactions, history, formatCurrency, onPayRemaining }: BalanceHeroProps) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const standing = useMemo(() => calculateAccountStanding(account, transactions), [account, transactions]);
	const visibility = getFieldVisibility(account.account_type, account.field_visibility);
	const isLiability = standing.accountClass === "liability";
	const balance = Number(account.current_balance);

	const points = useMemo(() => history.map((p) => ({ date: p.date, value: p.balance })), [history]);
	const active = activeIndex !== null ? points[activeIndex] : null;

	// Goal (assets) or original amount (debts), as configured for this account type.
	const goal = visibility.showOriginalAmount
		? account.original_amount
		: visibility.showTargetGoal
			? account.target_balance
			: null;
	const goalProgress = goal && goal > 0 ? (isLiability ? goal - balance : balance) : null;
	const goalPercent = goal && goalProgress !== null ? Math.min(100, Math.max(0, (goalProgress / goal) * 100)) : 0;

	const rate = visibility.showInterestRate && account.interest_rate ? account.interest_rate : null;
	const yearlyInterest = rate && balance > 0 ? balance * rate : null;
	const { whole, cents } = splitMoney(active ? active.value : balance);

	return (
		<section aria-labelledby="balance-heading" className="surface-sheet surface-sheet-pad">
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
				<div className="min-w-0">
					<h2 id="balance-heading" className="type-body-sm text-muted-foreground">
						{active ? formatFullDate(active.date) : isLiability ? "Owing" : "Balance"}
					</h2>
					<p className="type-display mt-1 flex items-start tabular-nums text-primary">
						<span>{whole}</span>
						<span className="dash-figure-cents">{cents}</span>
					</p>
				</div>
				{rate !== null && (
					<p className="type-body-sm text-muted-foreground">
						{(rate * 100).toFixed(2).replace(/\.?0+$/, "")}% {visibility.interestRateLabel.replace(" (%)", "")}
						{yearlyInterest !== null &&
							(isLiability
								? `, about ${formatCurrency(yearlyInterest)} a year in interest`
								: `, earning about ${formatCurrency(yearlyInterest)} a year`)}
					</p>
				)}
			</div>

			{points.length > 1 ? (
				<div className="mt-5">
					<NetWorthThread
						points={points}
						label={`${account.name} balance over time`}
						baseline={points[0].value}
						activeIndex={activeIndex}
						onActiveChange={setActiveIndex}
						animationKey={account.id}
					/>
				</div>
			) : (
				<p className="type-body-sm mt-4 text-muted-foreground">
					The balance line starts once this account has a few days of history.
				</p>
			)}

			<div className="mt-5 border-t border-border/70 pt-5">
				{isLiability ? (
					<dl className={cn("grid grid-cols-3 gap-4", account.credit_limit != null && "grid-cols-2 sm:grid-cols-4")}>
						<Stat label="Charged" value={formatCurrency(standing.totalAccumulatedDebt)} />
						<Stat label="Paid" value={formatCurrency(standing.totalPayments)} tone="success" />
						<Stat label="Left to pay" value={formatCurrency(standing.remainingDebt)} />
						{account.credit_limit != null && (
							<Stat label="Credit left" value={formatCurrency(standing.availableCredit)} />
						)}
					</dl>
				) : (
					<dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						<Stat label="Available to spend" value={formatCurrency(standing.availableBalance)} />
						{goal ? <Stat label="Goal" value={formatCurrency(goal)} /> : null}
						{goal ? (
							<Stat
								label={balance >= goal ? "Past goal by" : "To go"}
								value={formatCurrency(Math.abs(goal - balance))}
								tone={balance >= goal ? "success" : undefined}
							/>
						) : null}
					</dl>
				)}

				{goal && goalProgress !== null ? (
					<div className="mt-4">
						<ProgressLine value={goalPercent} tone={isLiability ? "bg-primary/70" : "bg-accent"} />
						<p className="type-body-xs mt-1.5 flex items-center gap-1.5 text-muted-foreground">
							{goalPercent >= 100 && <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />}
							{isLiability
								? goalPercent >= 100
									? "Paid off"
									: `${Math.round(goalPercent)}% paid off of ${formatCurrency(goal)}`
								: goalPercent >= 100
									? "Goal reached"
									: `${Math.round(goalPercent)}% of your goal`}
						</p>
					</div>
				) : null}

				<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="type-body-xs text-muted-foreground">
						{isLiability
							? "Payments can't go over what's left to pay unless you allow overpayment."
							: "Withdrawals and transfers out can't go over the available balance."}
					</p>
					{isLiability && standing.remainingDebt > 0 && (
						<Button
							size="sm"
							variant="outline"
							className="shrink-0 gap-1.5 rounded-full"
							onClick={() => onPayRemaining(standing.remainingDebt)}
						>
							Pay off {formatCurrency(standing.remainingDebt)}
							<ArrowRight className="h-3.5 w-3.5" aria-hidden />
						</Button>
					)}
				</div>
			</div>
		</section>
	);
}
