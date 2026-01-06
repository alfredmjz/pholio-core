import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "overpaid" | "upcoming" | "overdue" | "due_today";

interface StatusBadgeProps {
	status: PaymentStatus;
	className?: string;
	showLabel?: boolean;
}

export function StatusBadge({ status, className, showLabel = true }: StatusBadgeProps) {
	if (status === "paid" || status === "overpaid") {
		return (
			<Badge
				variant="outline" // Using default primary color but could be custom green
				className={cn("bg-success-muted text-success border-success gap-1", className)}
			>
				<Check className="h-3 w-3" />
				{showLabel && <span>Paid</span>}
			</Badge>
		);
	}

	if (status === "partial") {
		return (
			<Badge variant="outline" className={cn("bg-warning-muted text-warning border-warning gap-1", className)}>
				<AlertTriangle className="h-3 w-3" />
				{showLabel && <span>Partial</span>}
			</Badge>
		);
	}

	if (status === "overdue") {
		return (
			<Badge variant="outline" className={cn(" bg-error-muted text-error border-error gap-1", className)}>
				<AlertTriangle className="h-3 w-3" />
				{showLabel && <span>Past Due</span>}
			</Badge>
		);
	}

	if (status === "due_today") {
		return (
			<Badge variant="outline" className={cn("bg-warning-muted text-warning border-warning gap-1", className)}>
				<AlertTriangle className="h-3 w-3" />
				{showLabel && <span>Due Today</span>}
			</Badge>
		);
	}

	if (status === "upcoming") {
		return (
			<Badge variant="secondary" className={cn("hover:none", className)}>
				{showLabel ? "Upcoming" : ""}
			</Badge>
		);
	}

	return null;
}
