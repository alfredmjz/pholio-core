"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import type { AccountWithType, AccountTransaction } from "../../../types";
import { getFieldVisibility } from "../../../field-visibility";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

interface InsightsCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	accountClass: "asset" | "liability" | undefined;
	formatCurrency: (amount: number) => string;
}

export function InsightsCard({ account, transactions, accountClass, formatCurrency }: InsightsCardProps) {
	const visibility = getFieldVisibility(account.account_type?.category, account.account_type?.name);
	const category = account.account_type?.category;
	const isInvestment = category === "investment" || category === "retirement";
	const isLiability = accountClass === "liability";

	const goalValue = visibility.showOriginalAmount ? account.original_amount : account.target_balance;
	const hasGoal = !!goalValue && goalValue > 0;

	// 1. Investments -> Growth Composition
	if (isInvestment) {
		return <InvestmentComposition account={account} transactions={transactions} formatCurrency={formatCurrency} />;
	}

	// 2. Loans -> Principal vs Interest (Stacked Bar)
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

	// 3. Banking / Savings / Active Goals -> Goal Timeline Projection
	if (hasGoal) {
		return (
			<GoalTimelineProjection
				account={account}
				transactions={transactions}
				formatCurrency={formatCurrency}
				goalValue={goalValue}
				currentAmount={account.current_balance}
				isLiability={isLiability}
			/>
		);
	}

	// 4. Default Fallback (Standard checking accounts without goals) -> Return null per user request
	return null;
}

// ============================================================================
// Internal Chart Components
// ============================================================================

function GoalTimelineProjection({ transactions, goalValue, currentAmount, isLiability, formatCurrency }: any) {
	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
	const recentTx = transactions.filter((t: any) => parseLocalDate(t.transaction_date) >= sixMonthsAgo);

	let netFlow = 0;
	recentTx.forEach((t: any) => {
		if (t.transaction_type === "withdrawal" || t.transaction_type === "payment") {
			netFlow -= t.amount;
		} else {
			netFlow += t.amount;
		}
	});

	const avgMonthlyFlow = netFlow / 6;
	const progressingFlow = isLiability ? -avgMonthlyFlow : avgMonthlyFlow;
	const remainingToGoal = isLiability ? currentAmount : Math.max(goalValue - currentAmount, 0);

	let monthsToGoal = null;
	let targetDate = null;

	if (progressingFlow > 0 && remainingToGoal > 0) {
		monthsToGoal = Math.ceil(remainingToGoal / progressingFlow);
		targetDate = new Date(now.getFullYear(), now.getMonth() + monthsToGoal, 1);
	}

	const isDone = isLiability ? currentAmount <= 0 : currentAmount >= goalValue;
	const progressAmount = isLiability ? Math.max(0, goalValue - currentAmount) : currentAmount;
	const percent = Math.min(100, Math.max(0, (progressAmount / goalValue) * 100));

	return (
		<Card className="p-6">
			<h3 className="text-lg font-bold tracking-tight mb-6">{isLiability ? "Payoff Projection" : "Goal Timeline"}</h3>

			{isDone ? (
				<div className="flex flex-col items-center justify-center py-8 text-center text-green-600 dark:text-green-400">
					<div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
						<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<span className="text-xl font-bold tracking-tight">Status: Completed</span>
					<span className="text-sm font-medium mt-1 text-muted-foreground">
						{formatCurrency(currentAmount)} / {formatCurrency(goalValue)}
					</span>
				</div>
			) : monthsToGoal && targetDate ? (
				<div className="flex flex-col gap-8">
					<div className="flex justify-between items-end">
						<div className="flex flex-col gap-1">
							<span className="text-3xl font-bold tracking-tight text-primary">
								{monthsToGoal} <span className="text-lg text-muted-foreground font-medium">mos</span>
							</span>
							<span className="text-sm font-medium text-muted-foreground">Est. time remaining</span>
						</div>
						<div className="flex flex-col gap-1 text-right">
							<span className="text-xl font-bold tracking-tight">
								{targetDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
							</span>
							<span className="text-sm font-medium text-muted-foreground">Projected Date</span>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<div className="w-full h-3 rounded-full bg-muted overflow-hidden">
							<div className="h-full bg-primary transition-all duration-1000" style={{ width: `${percent}%` }} />
						</div>
						<div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
							<span>{formatCurrency(progressAmount)}</span>
							<span>{formatCurrency(goalValue)}</span>
						</div>
					</div>

					<div className="flex items-center gap-3 bg-muted/30 p-4 rounded-xl">
						<svg
							className="w-5 h-5 text-muted-foreground flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
						</svg>
						<p className="text-sm font-medium text-foreground">
							Based on your 6-month average of <span className="font-bold">{formatCurrency(progressingFlow)}</span>{" "}
							{isLiability ? "paid" : "saved"} per month.
						</p>
					</div>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
						<svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<span className="text-base font-bold tracking-tight mb-1">More Data Needed</span>
					<p className="text-sm font-medium text-muted-foreground max-w-[250px]">
						We need a consistent positive flow history to build a reliable timeline projection.
					</p>
				</div>
			)}
		</Card>
	);
}

function InvestmentComposition({ account, transactions, formatCurrency }: any) {
	const totalDeposits = transactions
		.filter((t: any) => t.transaction_type === "deposit" || t.transaction_type === "contribution")
		.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

	const returns = account.current_balance - totalDeposits;

	const data = [
		{ name: "Contributions", value: totalDeposits, fill: account.color || "#3b82f6" },
		{ name: "Growth (Returns)", value: returns > 0 ? returns : 0, fill: "#22c55e" },
	];

	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			return (
				<div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-3 gap-2 flex flex-col">
					<div className="flex items-center gap-2 text-sm">
						<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
						<span className="font-medium text-muted-foreground">{payload[0].name}</span>
					</div>
					<span className="font-bold text-base">{formatCurrency(payload[0].value)}</span>
				</div>
			);
		}
		return null;
	};

	return (
		<Card className="p-6">
			<h3 className="text-lg font-bold tracking-tight mb-2">Growth Composition</h3>

			<div className="h-[220px] w-full mt-4 flex items-center justify-center relative">
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<Pie
							data={data}
							innerRadius={70}
							outerRadius={90}
							paddingAngle={5}
							dataKey="value"
							stroke="none"
							cornerRadius={6}
						>
							{data.map((entry, index) => (
								<Cell key={index} fill={entry.fill} />
							))}
						</Pie>
						<RechartsTooltip content={<CustomTooltip />} />
					</PieChart>
				</ResponsiveContainer>
				<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
					<span className="text-2xl font-bold tracking-tight">{formatCurrency(account.current_balance)}</span>
					<span className="text-xs font-medium text-muted-foreground">Total Value</span>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4 mt-8">
				<div className="flex flex-col gap-1.5 items-center bg-muted/30 py-3 rounded-lg">
					<div className="flex items-center gap-2">
						<div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account.color || "#3b82f6" }} />
						<span className="text-xs font-medium text-muted-foreground">Contributions</span>
					</div>
					<span className="text-base font-bold">{formatCurrency(totalDeposits)}</span>
				</div>
				<div className="flex flex-col gap-1.5 items-center bg-muted/30 py-3 rounded-lg">
					<div className="flex items-center gap-2">
						<div className="w-2.5 h-2.5 rounded-full bg-green-500" />
						<span className="text-xs font-medium text-muted-foreground">Est. Growth</span>
					</div>
					<span
						className={cn(
							"text-base font-bold",
							returns >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
						)}
					>
						{returns > 0 ? "+" : ""}
						{formatCurrency(returns)}
					</span>
				</div>
			</div>
		</Card>
	);
}

function LoanComposition({ account, transactions, goalValue, formatCurrency }: any) {
	const interestPaid = transactions
		.filter((t: any) => t.transaction_type === "interest")
		.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

	const principalPaid = goalValue ? Math.max(goalValue - account.current_balance, 0) : 0;
	const totalPaid = interestPaid + principalPaid;

	const principalPercent = totalPaid > 0 ? (principalPaid / totalPaid) * 100 : 0;
	const interestPercent = totalPaid > 0 ? (interestPaid / totalPaid) * 100 : 0;

	return (
		<Card className="p-6">
			<h3 className="text-lg font-bold tracking-tight mb-8">Payment Composition</h3>

			<div className="flex flex-col gap-8">
				<div className="w-full h-10 flex rounded-full overflow-hidden bg-muted">
					{totalPaid > 0 ? (
						<>
							<div
								className="h-full bg-blue-500 transition-all duration-500"
								style={{ width: `${principalPercent}%` }}
							/>
							<div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${interestPercent}%` }} />
						</>
					) : (
						<div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-medium">
							No payments recorded
						</div>
					)}
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-blue-500" />
							<span className="text-sm font-medium text-muted-foreground">Principal Paid</span>
						</div>
						<span className="text-2xl font-bold tracking-tight">{formatCurrency(principalPaid)}</span>
					</div>
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-full bg-red-500" />
							<span className="text-sm font-medium text-muted-foreground">Interest Paid</span>
						</div>
						<span className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
							{formatCurrency(interestPaid)}
						</span>
					</div>
				</div>

				<div className="h-px bg-border my-2" />

				<div className="flex justify-between items-center bg-muted/20 p-4 rounded-xl">
					<span className="text-sm font-medium text-foreground">Total Value Paid</span>
					<span className="text-xl font-bold tracking-tight">{formatCurrency(totalPaid)}</span>
				</div>
			</div>
		</Card>
	);
}