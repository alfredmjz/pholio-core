'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { formatCurrency, formatCompactCurrency } from '@/app/dashboard/utils';
import { ASSET_COLORS, LIABILITY_COLORS } from '@/app/dashboard/chart-colors';
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
} from 'lucide-react';
import {
	PieChart as RechartsPieChart,
	Pie,
	Cell,
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from 'recharts';
import type { ChartType, Trend, AssetBreakdown, LiabilityBreakdown } from '../types';

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
	const hasData = totalAssets > 0 || totalLiabilities > 0;

	// Prepare donut chart data
	const donutData = useMemo(() => {
		const data: { name: string; value: number; color: string; type: 'asset' | 'liability' }[] = [];

		assetBreakdown.forEach((asset, index) => {
			if (asset.value > 0) {
				data.push({
					name: asset.category,
					value: asset.value,
					color: ASSET_COLORS[index % ASSET_COLORS.length],
					type: 'asset',
				});
			}
		});

		liabilityBreakdown.forEach((liability, index) => {
			if (liability.value > 0) {
				data.push({
					name: liability.category,
					value: liability.value,
					color: LIABILITY_COLORS[index % LIABILITY_COLORS.length],
					type: 'liability',
				});
			}
		});

		return data;
	}, [assetBreakdown, liabilityBreakdown]);

	if (loading) {
		return <NetWorthWidgetSkeleton className={className} />;
	}

	return (
		<Card className={cn('p-6 bg-card border border-border', className)}>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<div className={cn('p-2.5 rounded-lg', netWorth >= 0 ? 'bg-success-muted' : 'bg-error-muted')}>
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
								{trend.direction === 'up' && <ArrowUp className="h-3.5 w-3.5 text-success" />}
								{trend.direction === 'down' && <ArrowDown className="h-3.5 w-3.5 text-error" />}
								<span
									className={cn(
										'text-xs font-medium',
										trend.direction === 'up' && 'text-success',
										trend.direction === 'down' && 'text-error',
										trend.direction === 'neutral' && 'text-muted-foreground'
									)}
								>
									{trend.value > 0 ? '+' : ''}
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
					'mb-6 p-5 rounded-xl',
					netWorth >= 0
						? 'bg-gradient-to-br from-success-muted to-info-muted'
						: 'bg-gradient-to-br from-error-muted to-warning-muted'
				)}
			>
				<p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
				<p className="text-4xl font-bold text-foreground tracking-tight">{formatCurrency(netWorth)}</p>
			</div>

			{hasData ? (
				<>
					{/* Chart Area */}
					{chartType === 'donut' ? (
						<DonutChart data={donutData} netWorth={netWorth} />
					) : (
						<TrendChart data={trendData || []} />
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
									'h-4 w-4 text-muted-foreground transition-transform duration-200',
									isExpanded && 'rotate-180'
								)}
							/>
						</button>

						{isExpanded && (
							<DetailedBreakdown assetBreakdown={assetBreakdown} liabilityBreakdown={liabilityBreakdown} />
						)}
					</div>
				</>
			) : (
				<EmptyState />
			)}
		</Card>
	);
}

function DonutChart({
	data,
	netWorth,
}: {
	data: { name: string; value: number; color: string; type: 'asset' | 'liability' }[];
	netWorth: number;
}) {
	if (data.length === 0) {
		return (
			<div className="h-56 flex items-center justify-center">
				<div className="w-40 h-40 rounded-full border-8 border-muted flex items-center justify-center">
					<div className="text-center">
						<p className="text-xs text-muted-foreground">Net Worth</p>
						<p className="text-lg font-bold text-foreground">{formatCurrency(netWorth)}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-56 relative">
			<ResponsiveContainer width="100%" height="100%">
				<RechartsPieChart>
					<Pie
						data={data}
						cx="50%"
						cy="50%"
						innerRadius={55}
						outerRadius={85}
						paddingAngle={2}
						dataKey="value"
						animationDuration={500}
					>
						{data.map((entry, index) => (
							<Cell key={`cell-${index}`} fill={entry.color} />
						))}
					</Pie>
					<Tooltip
						content={({ active, payload }) => {
							if (!active || !payload || payload.length === 0) return null;
							const item = payload[0].payload;
							return (
								<div className="bg-card border border-border rounded-lg shadow-lg p-3">
									<p className="text-xs text-muted-foreground capitalize">{item.type}</p>
									<p className="text-sm font-semibold text-foreground">{item.name}</p>
									<p className={cn('text-sm font-bold', item.type === 'asset' ? 'text-info' : 'text-error')}>
										{formatCurrency(item.value)}
									</p>
								</div>
							);
						}}
					/>
				</RechartsPieChart>
			</ResponsiveContainer>

			{/* Center Label */}
			<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div className="text-center">
					<p className="text-xs text-muted-foreground">Net Worth</p>
					<p className="text-lg font-bold text-foreground">{formatCurrency(netWorth)}</p>
				</div>
			</div>
		</div>
	);
}

function TrendChart({ data }: { data: { date: string; value: number }[] }) {
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
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
					<defs>
						<linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
							<stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
					<XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
					<YAxis
						stroke="var(--muted-foreground)"
						fontSize={12}
						tickLine={false}
						axisLine={false}
						tickFormatter={formatCompactCurrency}
					/>
					<Tooltip
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
						stroke="var(--success)"
						strokeWidth={2}
						fill="url(#netWorthGradient)"
						animationDuration={500}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}

function DetailedBreakdown({
	assetBreakdown,
	liabilityBreakdown,
}: {
	assetBreakdown: AssetBreakdown[];
	liabilityBreakdown: LiabilityBreakdown[];
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
										<span className="text-muted-foreground">{getCategoryIcon(asset.category)}</span>
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
				<div className={assetBreakdown.length > 0 ? 'pt-3 border-t border-border' : ''}>
					<h4 className="text-sm font-semibold text-error mb-3">Liabilities</h4>
					<div className="space-y-3">
						{liabilityBreakdown.map((liability) => (
							<div key={liability.category}>
								<div className="flex items-center justify-between mb-1">
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">{getCategoryIcon(liability.category)}</span>
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
		<Card className={cn('p-6 bg-card border border-border animate-pulse', className)}>
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<div className="h-12 w-12 bg-muted rounded-lg" />
					<div>
						<div className="h-6 bg-muted rounded w-28 mb-1" />
						<div className="h-3 bg-muted rounded w-20" />
					</div>
				</div>
				<div className="h-9 bg-muted rounded w-20" />
			</div>
			<div className="h-24 bg-muted/50 rounded-xl mb-6" />
			<div className="h-56 bg-muted rounded" />
			<div className="grid grid-cols-2 gap-4 mt-6">
				<div className="h-20 bg-muted/50 rounded-lg" />
				<div className="h-20 bg-muted/50 rounded-lg" />
			</div>
		</Card>
	);
}
