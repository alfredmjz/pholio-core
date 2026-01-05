"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompactCurrency } from "@/app/dashboard/utils";
import { BarChart3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { Period, CashflowDataPoint } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer } from "@/components/common/ChartContainer";

interface CashflowWidgetProps {
	data: CashflowDataPoint[];
	totalIncome: number;
	totalExpenses: number;
	netCashflow: number;
	selectedPeriod: Period;
	onPeriodChange: (period: Period) => void;
	onAddTransaction?: () => void;
	loading?: boolean;
	className?: string;
}

// Custom Tooltip Props - based on Recharts TooltipProps
interface TooltipPayloadEntry {
	dataKey: string;
	value: number;
	color?: string;
}

interface CustomTooltipProps {
	active?: boolean;
	payload?: TooltipPayloadEntry[];
	label?: string;
}

// Custom Tooltip Component
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
	if (!active || !payload || payload.length === 0) return null;

	const income = payload.find((p) => p.dataKey === "income")?.value || 0;
	const expenses = payload.find((p) => p.dataKey === "expenses")?.value || 0;
	const net = income - expenses;

	return (
		<div className="bg-card border border-border rounded-lg shadow-lg p-4 min-w-[180px]">
			<p className="text-sm font-semibold text-primary mb-3">{label}</p>
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-6">
					<div className="flex items-center gap-2">
						<div className="w-2.5 h-2.5 rounded-sm bg-info" />
						<span className="text-xs text-primary">Income</span>
					</div>
					<span className="text-sm font-semibold text-primary">{formatCurrency(income)}</span>
				</div>
				<div className="flex items-center justify-between gap-6">
					<div className="flex items-center gap-2">
						<div className="w-2.5 h-2.5 rounded-sm bg-error" />
						<span className="text-xs text-primary">Expenses</span>
					</div>
					<span className="text-sm font-semibold text-primary">{formatCurrency(expenses)}</span>
				</div>
				<div className="border-t border-border pt-2 mt-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-primary">Net</span>
						<span className={cn("text-sm font-semibold", net >= 0 ? "text-success" : "text-error")}>
							{formatCurrency(net)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export function CashflowWidget({
	data,
	totalIncome,
	totalExpenses,
	netCashflow,
	selectedPeriod,
	onPeriodChange,
	onAddTransaction,
	loading = false,
	className,
}: CashflowWidgetProps) {
	const hasData = data && data.length > 0;

	if (loading) {
		return <CashflowWidgetSkeleton className={className} />;
	}

	return (
		<Card className={cn("p-6 bg-card border border-border min-w-0", className)}>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h3 className="text-xl font-semibold text-primary mb-1">Cash Flow</h3>
					<p className="text-xs text-primary">Income vs Expenses over time</p>
				</div>

				{/* Period Selector */}
				<ToggleGroup
					type="single"
					value={selectedPeriod}
					onValueChange={(value) => value && onPeriodChange(value as Period)}
					className="bg-muted rounded-lg p-1"
				>
					<ToggleGroupItem
						value="month"
						className="text-xs px-3 py-1.5 data-[state=on]:bg-card data-[state=on]:shadow-sm"
					>
						Month
					</ToggleGroupItem>
					<ToggleGroupItem
						value="quarter"
						className="text-xs px-3 py-1.5 data-[state=on]:bg-card data-[state=on]:shadow-sm"
					>
						Quarter
					</ToggleGroupItem>
					<ToggleGroupItem
						value="year"
						className="text-xs px-3 py-1.5 data-[state=on]:bg-card data-[state=on]:shadow-sm"
					>
						Year
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{/* Summary Row */}
			<div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
				<div>
					<p className="text-xs text-primary mb-1">Total Income</p>
					<p className="text-lg font-semibold text-info">{formatCurrency(totalIncome)}</p>
				</div>
				<div>
					<p className="text-xs text-primary mb-1">Total Expenses</p>
					<p className="text-lg font-semibold text-error">{formatCurrency(totalExpenses)}</p>
				</div>
				<div>
					<p className="text-xs text-primary mb-1">Net Cashflow</p>
					<p className={cn("text-lg font-semibold", netCashflow >= 0 ? "text-success" : "text-error")}>
						{formatCurrency(netCashflow)}
					</p>
				</div>
			</div>

			{/* Chart or Empty State */}
			{hasData ? (
				<>
					<ChartContainer height={288} className="my-0">
						<BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={4}>
							<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
							<XAxis dataKey="label" stroke="hsl(var(--primary))" fontSize={12} tickLine={false} axisLine={false} />
							<YAxis
								stroke="hsl(var(--primary))"
								fontSize={12}
								tickLine={false}
								axisLine={false}
								tickFormatter={formatCompactCurrency}
							/>
							<Tooltip
								isAnimationActive={false}
								content={<CustomTooltip />}
								cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
							/>
							<Bar dataKey="income" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} maxBarSize={40} />
							<Bar dataKey="expenses" fill="hsl(var(--error))" radius={[4, 4, 0, 0]} maxBarSize={40} />
						</BarChart>
					</ChartContainer>

					{/* Legend */}
					<div className="flex items-center justify-center gap-6 mt-4">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-sm bg-info" />
							<span className="text-xs text-primary">Income</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 rounded-sm bg-error" />
							<span className="text-xs text-primary">Expenses</span>
						</div>
					</div>
				</>
			) : (
				<EmptyState onAddTransaction={onAddTransaction} />
			)}
		</Card>
	);
}

function EmptyState({ onAddTransaction }: { onAddTransaction?: () => void }) {
	return (
		<div className="h-72 flex flex-col items-center justify-center text-center">
			<div className="p-4 rounded-full bg-muted mb-4">
				<BarChart3 className="h-8 w-8 text-primary" />
			</div>
			<h4 className="text-base font-semibold text-primary mb-1">No cashflow data yet</h4>
			<p className="text-sm text-primary mb-4 max-w-sm">
				Start tracking your income and expenses to see your cashflow trends
			</p>
			<Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={onAddTransaction}>
				<Plus className="h-4 w-4" />
				Add Transaction
			</Button>
		</div>
	);
}

export function CashflowWidgetSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn("p-6 bg-card border border-border", className)}>
			<div className="flex items-center justify-between mb-6">
				<div>
					<Skeleton className="h-6 w-32 mb-2" />
					<Skeleton className="h-3 w-48" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<div className="grid grid-cols-3 gap-4 mb-6">
				{[1, 2, 3].map((i) => (
					<div key={i} className="p-4 bg-muted/50 rounded-lg">
						<Skeleton className="h-3 w-20 mb-2" />
						<Skeleton className="h-5 w-24" />
					</div>
				))}
			</div>
			<Skeleton className="h-72 w-full" />
		</Card>
	);
}
