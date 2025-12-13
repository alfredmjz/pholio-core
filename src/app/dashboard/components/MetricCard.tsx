"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Trend } from "../types";

interface MetricCardProps {
	label: string;
	value: number;
	trend?: Trend;
	icon?: React.ReactNode;
	variant?: "default" | "success" | "error" | "warning" | "info";
	loading?: boolean;
	className?: string;
}

const variantStyles = {
	default: {
		iconBg: "bg-muted",
		iconColor: "text-muted-foreground",
	},
	success: {
		iconBg: "bg-success-muted",
		iconColor: "text-success",
	},
	error: {
		iconBg: "bg-error-muted",
		iconColor: "text-error",
	},
	warning: {
		iconBg: "bg-warning-muted",
		iconColor: "text-warning",
	},
	info: {
		iconBg: "bg-info-muted",
		iconColor: "text-info",
	},
};

export function MetricCard({
	label,
	value,
	trend,
	icon,
	variant = "default",
	loading = false,
	className,
}: MetricCardProps) {
	const styles = variantStyles[variant];

	if (loading) {
		return (
			<Card className={cn("p-6 bg-card border border-border", className)}>
				<div className="animate-pulse">
					<div className="flex items-center justify-between mb-3">
						<div className="h-4 bg-muted rounded w-24" />
						<div className="h-10 w-10 bg-muted rounded-lg" />
					</div>
					<div className="h-9 bg-muted rounded w-32 mb-2" />
					<div className="h-3 bg-muted rounded w-20" />
				</div>
			</Card>
		);
	}

	return (
		<Card className={cn("p-6 bg-card border border-border hover:shadow-md transition-shadow duration-200", className)}>
			{/* Icon + Label Row */}
			<div className="flex items-center justify-between mb-3">
				<span className="text-sm font-medium text-muted-foreground">{label}</span>
				{icon && (
					<div className={cn("p-2.5 rounded-lg", styles.iconBg)}>
						<div className={styles.iconColor}>{icon}</div>
					</div>
				)}
			</div>

			{/* Value */}
			<div className="text-3xl font-bold tracking-tight text-foreground mb-2">{formatCurrency(value)}</div>

			{/* Trend Indicator */}
			{trend && (
				<div className="flex items-center gap-1.5">
					{trend.direction === "up" && <TrendingUp className="h-4 w-4 text-success" />}
					{trend.direction === "down" && <TrendingDown className="h-4 w-4 text-error" />}
					{trend.direction === "neutral" && <Minus className="h-4 w-4 text-muted-foreground" />}
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
		</Card>
	);
}

export function MetricCardSkeleton({ className }: { className?: string }) {
	return (
		<Card className={cn("p-6 bg-card border border-border", className)}>
			<div className="animate-pulse">
				<div className="flex items-center justify-between mb-3">
					<div className="h-4 bg-muted rounded w-24" />
					<div className="h-10 w-10 bg-muted rounded-lg" />
				</div>
				<div className="h-9 bg-muted rounded w-32 mb-2" />
				<div className="h-3 bg-muted rounded w-20" />
			</div>
		</Card>
	);
}
