"use client";

import {
	RefreshCw,
	CreditCard,
	Landmark,
	Smartphone,
	Percent,
	TrendingUp,
	DollarSign,
	ArrowLeftRight,
	LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TransactionType =
	| "recurring"
	| "one_time"
	| "loan"
	| "subscription"
	| "interest"
	| "investment"
	| "income"
	| "transfer";

interface TransactionTypeConfig {
	icon: LucideIcon;
	bgColor: string;
	textColor: string;
	label: string;
}

export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, TransactionTypeConfig> = {
	recurring: {
		icon: RefreshCw,
		bgColor: "bg-blue-100 dark:bg-blue-900/30",
		textColor: "text-blue-700 dark:text-blue-400",
		label: "Recurring",
	},
	one_time: {
		icon: CreditCard,
		bgColor: "bg-gray-100 dark:bg-gray-800/50",
		textColor: "text-gray-700 dark:text-gray-400",
		label: "One-time",
	},
	loan: {
		icon: Landmark,
		bgColor: "bg-orange-100 dark:bg-orange-900/30",
		textColor: "text-orange-700 dark:text-orange-400",
		label: "Loan",
	},
	subscription: {
		icon: Smartphone,
		bgColor: "bg-purple-100 dark:bg-purple-900/30",
		textColor: "text-purple-700 dark:text-purple-400",
		label: "Subscription",
	},
	interest: {
		icon: Percent,
		bgColor: "bg-red-100 dark:bg-red-900/30",
		textColor: "text-red-700 dark:text-red-400",
		label: "Interest",
	},
	investment: {
		icon: TrendingUp,
		bgColor: "bg-green-100 dark:bg-green-900/30",
		textColor: "text-green-700 dark:text-green-400",
		label: "Investment",
	},
	income: {
		icon: DollarSign,
		bgColor: "bg-green-100 dark:bg-green-900/30",
		textColor: "text-green-700 dark:text-green-400",
		label: "Income",
	},
	transfer: {
		icon: ArrowLeftRight,
		bgColor: "bg-slate-100 dark:bg-slate-800/50",
		textColor: "text-slate-700 dark:text-slate-400",
		label: "Transfer",
	},
};

interface TransactionTypeIconProps {
	type: TransactionType;
	size?: "sm" | "md" | "lg";
	showLabel?: boolean;
	className?: string;
}

export function TransactionTypeIcon({ type, size = "md", showLabel = false, className }: TransactionTypeIconProps) {
	const config = TRANSACTION_TYPE_CONFIG[type];
	const Icon = config.icon;

	const iconSizes = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	};

	if (showLabel) {
		return (
			<Badge variant="secondary" className={cn(config.bgColor, config.textColor, "gap-1.5 font-medium", className)}>
				<Icon className={iconSizes[size]} />
				{config.label}
			</Badge>
		);
	}

	return (
		<div
			className={cn("inline-flex items-center justify-center rounded-md p-1.5", config.bgColor, className)}
			title={config.label}
		>
			<Icon className={cn(iconSizes[size], config.textColor)} />
		</div>
	);
}

// Helper to infer transaction type from transaction data (placeholder logic)
export function inferTransactionType(transaction: {
	name: string;
	amount: number;
	notes?: string;
	source?: string;
	recurring_expense_id?: string | null;
}): TransactionType {
	// Priority 1: Explicit recurring link
	if (transaction.recurring_expense_id) {
		return "recurring";
	}

	// Priority 2: Source-based detection
	if (transaction.source === "recurring") {
		return "recurring";
	}

	const name = transaction.name.toLowerCase();
	const notes = transaction.notes?.toLowerCase() || "";

	// Simple heuristic rules - in real app, this would come from database
	if (name.includes("subscription") || name.includes("netflix") || name.includes("spotify")) {
		return "subscription";
	}
	if (name.includes("loan") || name.includes("mortgage")) {
		return "loan";
	}
	if (name.includes("interest")) {
		return "interest";
	}
	if (name.includes("salary") || name.includes("paycheck") || transaction.amount > 0) {
		return "income";
	}
	if (name.includes("rent") || name.includes("utility") || name.includes("electric") || name.includes("water")) {
		return "recurring";
	}
	if (name.includes("transfer") || name.includes("venmo") || name.includes("zelle")) {
		return "transfer";
	}
	if (name.includes("invest") || name.includes("401k") || name.includes("ira")) {
		return "investment";
	}

	return "one_time";
}
