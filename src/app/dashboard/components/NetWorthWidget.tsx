"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import {
	TrendingUp,
	TrendingDown,
	ArrowUp,
	ArrowDown,
	PieChart,
	LineChart,
	Wallet,
	CreditCard,
	ChevronDown,
	Plus,
	Building,
	Car,
	Home,
	Briefcase,
	PiggyBank,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ChartType, Trend, AssetBreakdown, LiabilityBreakdown } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/common/DonutChart";

interface NetWorthWidgetProps {
	netWorth: number;
	totalAssets: number;
	totalLiabilities: number;
	trend?: Trend;
	assetBreakdown: AssetBreakdown[];
	liabilityBreakdown: LiabilityBreakdown[];
	trendData?: { date: string; value: number }[];
	chartType: ChartType;
	onChartTypeChange: (type: ChartType) => void;
	loading?: boolean;
	className?: string;
}

export function NetWorthWidget({
	netWorth,
	totalAssets,
	totalLiabilities,
	trend,
	assetBreakdown,
	liabilityBreakdown,
	trendData,
	chartType,
	onChartTypeChange,
	loading = false,
	className,
}: NetWorthWidgetProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [mounted, setMounted] = useState(false);
	const hasData = totalAssets > 0 || totalLiabilities > 0;

	useEffect(() => {
		setMounted(true);
	}, []);

	// Prepare donut chart data
	const { donutData, assetColors, liabilityColors } = useMemo(() => {
		const data: { name: string; value: number; color: string }[] = [];
		const assetColors: Record<string, string> = {};
		const liabilityColors: Record<string, string> = {};

		const BRIGHT_COLORS = [
			"#06b6d4", // cyan-500
			"#10b981", // emerald-500
			"#f59e0b", // amber-500
			"#ec4899", // pink-500
			"#3b82f6", // blue-500
			"#ef4444", // red-500
			"#8b5cf6", // purple-500
			"#f97316", // orange-500
		];

		let colorIndex = 0;

		assetBreakdown.forEach((asset) => {
			if (asset.value > 0) {
				const color = BRIGHT_COLORS[colorIndex % BRIGHT_COLORS.length];
				data.push({
					name: asset.category,
					value: asset.value,
					color,
				});
				assetColors[asset.category] = color;
				colorIndex++;
			}
		});

		liabilityBreakdown.forEach((liability) => {
			if (liability.value > 0) {
				const color = BRIGHT_COLORS[colorIndex % BRIGHT_COLORS.length];
				data.push({
					name: liability.category,
					value: liability.value,
					color,
				});
				liabilityColors[liability.category] = color;
				colorIndex++;
			}
		});

		return { donutData: data, assetColors, liabilityColors };
	}, [assetBreakdown, liabilityBreakdown]);

	if (loading) {
		return <NetWorthWidgetSkeleton className={className} />;
	}

	const CenterContent = (
		<div className="flex flex-col items-center justify-center">
			<span className="text-xs text-muted-foreground">Net Worth</span>
			<span className="text-xl font-bold text-foreground">{formatCurrency(netWorth)}</span>
		</div>
	);

	return (
		<Card className={cn("p-6 bg-card border border-border min-w-0", className)}>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<div className={cn("p-2.5 rounded-lg", netWorth >= 0 ? "bg-success-muted" : "bg-error-muted")}>
						{netWorth >= 0 ? (
							<TrendingUp className="h-5 w-5 text-success" />
						) : (
							<TrendingDown className="h-5 w-5 text-error" />
						)}
					</div>
					<div>
						<h3 className="text-xl font-semibold text-foreground">Net Worth</h3>
						{trend && (
							<div className="flex items-center gap-1.5 mt-0.5">
								{trend.direction === "up" && <ArrowUp className="h-3.5 w-3.5 text-success" />}
								{trend.direction === "down" && <ArrowDown className="h-3.5 w-3.5 text-error" />}
								<span
									className={cn(
										"text-xs font-medium",
										trend.direction === "up" && "text-success",
										trend.direction === "down" && "text-error",
										trend.direction === "neutral" && "text-muted-foreground"
									)}
								>
									{trend.value > 0 ? "+" : ""}
									{trend.value.toFixed(1)}% {trend.period}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Chart Type Toggle */}
				<ToggleGroup
					type="single"
					value={chartType}
					onValueChange={(value) => value && onChartTypeChange(value as ChartType)}
					className="bg-muted rounded-lg p-1"
				>
					<ToggleGroupItem
						value="donut"
						className="p-2 data-[state=on]:bg-card data-[state=on]:shadow-sm"
						title="Breakdown view"
					>
						<PieChart className="h-4 w-4" />
					</ToggleGroupItem>
					<ToggleGroupItem
						value="trend"
						className="p-2 data-[state=on]:bg-card data-[state=on]:shadow-sm"
						title="Trend view"
					>
						<LineChart className="h-4 w-4" />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{/* Net Worth Display */}
			<div
				className={cn(
					"mb-6 p-5 rounded-xl",
					netWorth >= 0
						? "bg-gradient-to-br from-success-muted to-info-muted"
						: "bg-gradient-to-br from-error-muted to-warning-muted"
				)}
			>
				<p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
				<p className="text-4xl font-bold text-foreground tracking-tight">{formatCurrency(netWorth)}</p>
			</div>

			{hasData ? (
				<>
					{/* Chart Area */}
					{chartType === "donut" ? (
						<div className="h-56 flex items-center justify-center">
							{mounted ? (
								<DonutChart
									data={donutData}
									size={40}
									strokeWidth={12}
									centerContent={CenterContent}
									showTooltip={true}
								/>
							) : (
								<div className="w-40 h-40 rounded-full border-8 border-muted" />
							)}
						</div>
					) : (
						<TrendChart data={trendData || []} mounted={mounted} />
					)}

					{/* Breakdown Summary */}
					<div className="grid grid-cols-2 gap-4 mt-6">
						{/* Assets */}
						<div className="p-4 bg-info-muted rounded-lg border border-border">
							<div className="flex items-center gap-2 mb-2">
								<Wallet className="h-4 w-4 text-info" />
								<span className="text-xs font-medium text-muted-foreground">Assets</span>
							</div>
							<p className="text-xl font-semibold text-info">{formatCurrency(totalAssets)}</p>
						</div>

						{/* Liabilities */}
						<div className="p-4 bg-error-muted rounded-lg border border-border">
							<div className="flex items-center gap-2 mb-2">
								<CreditCard className="h-4 w-4 text-error" />
								<span className="text-xs font-medium text-muted-foreground">Liabilities</span>
							</div>
							<p className="text-xl font-semibold text-error">{formatCurrency(totalLiabilities)}</p>
						</div>
					</div>

					{/* Expandable Detailed Breakdown */}
					<div className="mt-4">
						<button
							onClick={() => setIsExpanded(!isExpanded)}
							className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted transition-colors duration-150 text-left"
						>
							<span className="text-sm font-medium text-foreground">View detailed breakdown</span>
							<ChevronDown
								className={cn(
									"h-4 w-4 text-muted-foreground transition-transform duration-200",
									isExpanded && "rotate-180"
								)}
							/>
						</button>

						{isExpanded && (
							<DetailedBreakdown
								assetBreakdown={assetBreakdown}
								liabilityBreakdown={liabilityBreakdown}
								assetColors={assetColors}
								liabilityColors={liabilityColors}
							/>
						)}
					</div>
				</>
			) : (
				<EmptyState />
			)}
		</Card>
	);
}

function TrendChart({ data, mounted }: { data: { date: string; value: number }[]; mounted: boolean }) {
	const formatCompactCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(value);
	};

	if (data.length === 0) {
		return (
			<div className="h-56 flex flex-col items-center justify-center text-center">
				<LineChart className="h-8 w-8 text-muted-foreground mb-2" />
				<p className="text-sm text-muted-foreground">Not enough data for trend view</p>
				<p className="text-xs text-muted-foreground">Track your balances monthly to see trends</p>
			</div>
		);
	}

	return (
		<div className="h-56">
			{mounted ? (
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
						<defs>
							<linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
								<stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
						<XAxis
							dataKey="date"
							stroke="hsl(var(--muted-foreground))"
							fontSize={12}
							tickLine={false}
							axisLine={false}
						/>
						<YAxis
							stroke="hsl(var(--muted-foreground))"
							fontSize={12}
							tickLine={false}
							axisLine={false}
							tickFormatter={formatCompactCurrency}
						/>
						<Tooltip
							isAnimationActive={false}
							content={({ active, payload, label }) => {
								if (!active || !payload || payload.length === 0) return null;
								return (
									<div className="bg-card border border-border rounded-lg shadow-lg p-3">
										<p className="text-xs text-muted-foreground">{label}</p>
										<p className="text-sm font-semibold text-success">{formatCurrency(payload[0].value as number)}</p>
									</div>
								);
							}}
						/>
						<Area
							type="monotone"
							dataKey="value"
							stroke="hsl(var(--success))"
							strokeWidth={2}
							fill="url(#netWorthGradient)"
							animationDuration={500}
						/>
					</AreaChart>
				</ResponsiveContainer>
			) : (
				<div className="h-full w-full flex items-center justify-center">
					<Skeleton className="h-full w-full" />
				</div>
			)}
		</div>
	);
}

function DetailedBreakdown({
	assetBreakdown,
	liabilityBreakdown,
	assetColors,
	liabilityColors,
}: {
	assetBreakdown: AssetBreakdown[];
	liabilityBreakdown: LiabilityBreakdown[];
	assetColors: Record<string, string>;
	liabilityColors: Record<string, string>;
}) {
	const getCategoryIcon = (category: string) => {
		const iconMap: Record<string, React.ReactNode> = {
			banking: <PiggyBank className="h-3.5 w-3.5" />,
			investment: <Briefcase className="h-3.5 w-3.5" />,
			retirement: <Building className="h-3.5 w-3.5" />,
			property: <Home className="h-3.5 w-3.5" />,
			credit: <CreditCard className="h-3.5 w-3.5" />,
			debt: <Car className="h-3.5 w-3.5" />,
		};
		return iconMap[category.toLowerCase()] || <Wallet className="h-3.5 w-3.5" />;
	};

	return (
		<div className="space-y-4 p-4 bg-muted/30 rounded-lg mt-2">
			{/* Assets */}
			{assetBreakdown.length > 0 && (
				<div>
					<h4 className="text-sm font-semibold text-info mb-3">Assets</h4>
					<div className="space-y-3">
						{assetBreakdown.map((asset) => (
							<div key={asset.category}>
								<div className="flex items-center justify-between mb-1">
									<div className="flex items-center gap-2">
										<span
											className={cn(!assetColors[asset.category] && "text-muted-foreground")}
											style={{ color: assetColors[asset.category] }}
										>
											{getCategoryIcon(asset.category)}
										</span>
										<span className="text-sm font-medium text-foreground capitalize">{asset.category}</span>
									</div>
									<span className="text-sm font-semibold text-info">{formatCurrency(asset.value)}</span>
								</div>
								{asset.accounts.length > 0 && (
									<div className="ml-6 space-y-1">
										{asset.accounts.map((account) => (
											<div key={account.name} className="flex items-center justify-between text-xs">
												<span className="text-muted-foreground">{account.name}</span>
												<span className="text-foreground">{formatCurrency(account.value)}</span>
											</div>
										))}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Liabilities */}
			{liabilityBreakdown.length > 0 && (
				<div className={assetBreakdown.length > 0 ? "pt-3 border-t border-border" : ""}>
					<h4 className="text-sm font-semibold text-error mb-3">Liabilities</h4>
					<div className="space-y-3">
						{liabilityBreakdown.map((liability) => (
							<div key={liability.category}>
								<div className="flex items-center justify-between mb-1">
									<div className="flex items-center gap-2">
										<span
											className={cn(!liabilityColors[liability.category] && "text-muted-foreground")}
											style={{ color: liabilityColors[liability.category] }}
										>
											{getCategoryIcon(liability.category)}
										</span>
										<span className="text-sm font-medium text-foreground capitalize">{liability.category}</span>
									</div>
									<span className="text-sm font-semibold text-error">{formatCurrency(liability.value)}</span>
								</div>
								{liability.accounts.length > 0 && (
									<div className="ml-6 space-y-1">
										{liability.accounts.map((account) => (
											<div key={account.name} className="flex items-center justify-between text-xs">
												<span className="text-muted-foreground">{account.name}</span>
												<span className="text-foreground">{formatCurrency(account.value)}</span>
											</div>
										))}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="h-64 flex flex-col items-center justify-center text-center">
			<div className="p-4 rounded-full bg-muted mb-4">
				<PieChart className="h-8 w-8 text-muted-foreground" />
			</div>
			<h4 className="text-base font-semibold text-foreground mb-1">Build your net worth snapshot</h4>
			<p className="text-sm text-muted-foreground mb-4 max-w-sm">
				Add your assets and liabilities to track your financial health
			</p>
			<Button size="sm" variant="outline" className="gap-2">
				<Plus className="h-4 w-4" />
				Add Account
			</Button>
		</div>
	);
}

export function NetWorthWidgetSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn("p-6 bg-card border border-border", className)}>
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<Skeleton className="h-12 w-12 rounded-lg" />
					<div>
						<Skeleton className="h-6 w-28 mb-1" />
						<Skeleton className="h-3 w-20" />
					</div>
				</div>
				<Skeleton className="h-9 w-20" />
			</div>
			<Skeleton className="h-24 w-full rounded-xl mb-6" />
			<Skeleton className="h-56 w-full" />
			<div className="grid grid-cols-2 gap-4 mt-6">
				<Skeleton className="h-20 w-full rounded-lg" />
				<Skeleton className="h-20 w-full rounded-lg" />
			</div>
		</Card>
	);
}
