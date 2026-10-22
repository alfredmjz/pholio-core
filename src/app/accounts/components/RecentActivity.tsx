"use client";

import { SurfaceSection } from "@/components/layout/surface-section";
import { cn } from "@/lib/utils";
import { Clock, CheckCircle2, PlusCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/date-utils";
import type { RecentActivityItem } from "../actions";

interface RecentActivityProps {
	activity: RecentActivityItem[];
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: "CAD",
		minimumFractionDigits: 2,
	}).format(amount);
}

function getActivityDetails(item: RecentActivityItem): {
	title: string;
	details: string;
	icon: "added" | "updated" | "deposit" | "withdrawal";
} {
	if (item.type === "account_created") {
		return {
			title: "Account added",
			details: "New account created",
			icon: "added",
		};
	}

	// Transaction
	const txType = item.transactionType || "transaction";
	const amount = item.amount ? formatCurrency(item.amount) : "";

	switch (txType) {
		case "deposit":
		case "contribution":
			return {
				title: "Deposited",
				details: item.description || `${amount} deposited`,
				icon: "deposit",
			};
		case "withdrawal":
			return {
				title: "Withdrew",
				details: item.description || `${amount} withdrawn`,
				icon: "withdrawal",
			};
		case "payment":
			return {
				title: "Payment",
				details: item.description || `${amount} payment made`,
				icon: "withdrawal",
			};
		case "interest":
			return {
				title: "Interest",
				details: item.description || `${amount} interest earned`,
				icon: "deposit",
			};
		case "adjustment":
			return {
				title: "Adjustment",
				details: item.description || `Balance adjusted by ${amount}`,
				icon: "updated",
			};
		case "transfer":
			return {
				title: "Transfer",
				details: item.description || `${amount} transferred`,
				icon: "updated",
			};
		default:
			return {
				title: "Updated",
				details: item.description || `${amount}`,
				icon: "updated",
			};
	}
}

const ICON_STYLE = {
	added: { icon: PlusCircle, tone: "bg-accent-muted text-accent" },
	updated: { icon: CheckCircle2, tone: "bg-card-muted text-primary" },
	deposit: { icon: ArrowDownLeft, tone: "bg-success-muted text-success" },
	withdrawal: { icon: ArrowUpRight, tone: "bg-card-muted text-primary" },
} as const;

/** The latest changes across all accounts, newest first, on a thin timeline. */
export function RecentActivity({ activity }: RecentActivityProps) {
	return (
		<SurfaceSection id="account-activity-heading" title="Recent activity" note="Latest changes across your accounts">
			{activity.length === 0 ? (
				<div className="flex flex-col items-start gap-2 py-4">
					<Clock className="h-5 w-5 text-muted-foreground" aria-hidden />
					<p className="type-body-sm text-muted-foreground">
						Deposits, payments and new accounts show up here as they happen.
					</p>
				</div>
			) : (
				<ol className="relative">
					{activity.map((item, index) => {
						const { title, details, icon } = getActivityDetails(item);
						const style = ICON_STYLE[icon];
						const Icon = style.icon;
						return (
							<li key={item.id} className="relative pb-5 pl-10 last:pb-0">
								{index !== activity.length - 1 && (
									<span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" aria-hidden />
								)}
								<span
									className={cn(
										"absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full",
										style.tone
									)}
									aria-hidden
								>
									<Icon className="h-3.5 w-3.5" />
								</span>
								<div className="flex items-baseline justify-between gap-3">
									<p className="type-body-sm font-medium text-primary">{title}</p>
									<time className="type-body-xs shrink-0 text-muted-foreground" dateTime={item.timestamp}>
										{formatRelativeTime(item.timestamp)}
									</time>
								</div>
								<p className="type-body-sm text-text-secondary">{item.accountName}</p>
								<p className="type-body-xs text-muted-foreground">{details}</p>
							</li>
						);
					})}
				</ol>
			)}
		</SurfaceSection>
	);
}
