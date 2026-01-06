"use client";

import Link from "next/link";
import { AccountWithType } from "../types";
import { cn } from "@/lib/utils";
import { Landmark, Wallet, CreditCard, Building, TrendingUp, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AccountCardProps {
	account: AccountWithType;
	onClick?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 50 : undefined,
		position: "relative" as const,
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-CA", {
			style: "currency",
			currency: account.currency || "CAD",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
	};

	const accountClass = account.account_type?.class;
	const category = account.account_type?.category;

	const getAccountIcon = () => {
		switch (category) {
			case "banking":
				return <Landmark className="h-5 w-5" />;
			case "investment":
			case "retirement":
				return <TrendingUp className="h-5 w-5" />;
			case "property":
				return <Building className="h-5 w-5" />;
			case "credit":
			case "debt":
				return <CreditCard className="h-5 w-5" />;
			default:
				return <Wallet className="h-5 w-5" />;
		}
	};

	const getIconColor = () => {
		if (accountClass === "asset") {
			return "bg-green-100/50 text-green-600 dark:bg-green-500/10 dark:text-green-400";
		}
		return "bg-red-100/50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
	};

	const getProgressPercentage = () => {
		if (accountClass === "asset") {
			if (!account.target_balance) return null;
			return (account.current_balance / account.target_balance) * 100;
		} else {
			// Liability handling
			if (account.credit_limit) {
				// Credit Card: Usage %
				return (account.current_balance / account.credit_limit) * 100;
			}
			if (account.original_amount) {
				// Loan: Payoff %
				return ((account.original_amount - account.current_balance) / account.original_amount) * 100;
			}
			return null;
		}
	};

	const progress = getProgressPercentage();

	const getAccountTypeLabel = () => {
		const typeName = account.account_type.name.toLowerCase();
		if (typeName.includes("investment")) return "Investment";
		if (typeName.includes("brokerage")) return "Brokerage";
		if (typeName.includes("savings")) return "Savings";
		if (typeName.includes("credit card")) return "Credit Card";
		if (typeName.includes("loan")) return "Loan";
		if (category === "retirement") return "Retirement";
		return account.account_type.name;
	};

	const getProgressLabel = () => {
		if (accountClass === "asset") return "Goal Progress";
		if (account.credit_limit) return "Credit Usage";
		return "Paid Off";
	};

	const getProgressBreakdown = () => {
		if (progress === null || !account.percent_change || accountClass !== "asset" || account.percent_change <= 0) {
			return { base: progress, contribution: 0 };
		}
		const current = account.current_balance;
		const previous = current / (1 + account.percent_change / 100);
		const changeAmount = current - previous;
		const target = account.target_balance || 1;
		const contribution = (changeAmount / target) * 100;
		const base = (progress || 0) - contribution;
		return { base: Math.max(0, base), contribution: Math.max(0, contribution) };
	};

	const { base: baseProgress, contribution: contributionProgress } = getProgressBreakdown();

	const cardClasses = cn(
		"block w-full text-left px-6 transition-all duration-200 bg-card hover:bg-accent relative hover:z-10 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_24px_rgba(255,255,255,0.06)] min-h-[140px] flex flex-col justify-center group",
		isDragging && "opacity-50 ring-2 ring-primary ring-offset-2 z-50 bg-accent shadow-xl scale-[1.02]"
	);

	const Content = (
		<div className="relative flex items-start gap-4 h-full">
			{/* Drag Handle */}
			<div
				{...attributes}
				{...listeners}
				className={cn(
					"absolute -left-16 top-5 -translate-y-1/2 p-2 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all z-20 touch-none hover:bg-muted rounded cursor-grab",
					isDragging ? "opacity-100 cursor-grabbing" : "cursor-grab"
				)}
				onClick={(e) => e.stopPropagation()}
				onMouseDown={(e) => e.stopPropagation()}
			>
				<GripVertical className="h-4 w-4" />
			</div>

			{/* Account Icon */}
			<div className={cn("p-2.5 rounded-xl shrink-0 transition-colors", getIconColor())}>{getAccountIcon()}</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="flex items-center gap-2 mb-1">
							<span className="font-semibold truncate text-primary text-sm">{account.name}</span>
							<Badge
								variant="secondary"
								className="text-[10px] px-1.5 py-0 h-5 font-normal text-primary border-border/50 bg-secondary/50"
							>
								{getAccountTypeLabel()}
							</Badge>
						</div>
						<div className="text-xs text-primary mb-3">{account.institution || "Generic Bank"}</div>
					</div>

					<div className="text-right">
						<div
							className={cn(
								"font-bold tracking-tight text-sm",
								accountClass === "asset" ? "" : "text-red-600 dark:text-red-400"
							)}
						>
							{accountClass === "liability" && "-"}
							{formatCurrency(account.current_balance)}
						</div>
					</div>
				</div>

				{progress !== null && (
					<div className="mt-2 space-y-1.5">
						<div className="flex items-center justify-between text-xs font-medium">
							<span className="text-primary">{getProgressLabel()}</span>
							<div className="flex items-center gap-1">
								{contributionProgress > 0 ? (
									<>
										<span className="text-primary">{(baseProgress ?? 0).toFixed(0)}%</span>
										<span className="text-green-500"> + {contributionProgress.toFixed(0)}%</span>
									</>
								) : (
									<span className="text-primary">{progress.toFixed(0)}%</span>
								)}
							</div>
						</div>
						<div className="h-2 bg-muted rounded-full overflow-hidden flex items-center">
							<div
								className={cn(
									"h-full transition-all duration-500",
									accountClass === "asset" ? "bg-green-600 dark:bg-green-500" : "bg-red-500"
								)}
								style={{ width: `${Math.min(baseProgress || progress || 0, 100)}%` }}
							/>
							{contributionProgress > 0 && (
								<div
									className="h-full bg-green-500/30 border border-green-500 rounded-r-full box-border transition-all duration-500"
									style={{ width: `${Math.min(contributionProgress, 100 - (baseProgress || 0))}%` }}
								/>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);

	// When dragging, don't wrap in Link - just show the content
	if (isDragging) {
		return (
			<div ref={setNodeRef} style={style} className="relative touch-none">
				<div className={cardClasses}>{Content}</div>
			</div>
		);
	}

	return (
		<div ref={setNodeRef} style={style} className="relative touch-none">
			{onClick ? (
				<button onClick={onClick} className={cardClasses}>
					{Content}
				</button>
			) : (
				<Link href={`/balancesheet/accountdetail/${account.id}`} className={cardClasses}>
					{Content}
				</Link>
			)}
		</div>
	);
}
