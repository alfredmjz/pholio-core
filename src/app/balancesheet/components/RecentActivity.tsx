"use client";

import { Card } from "@/components/ui/card";
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
			title: "Account Added",
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

export function RecentActivity({ activity }: RecentActivityProps) {
	const hasActivity = activity.length > 0;

	return (
		<Card className="flex flex-col h-full bg-card border shadow-sm">
			<div className="p-6 pb-4">
				<h3 className="text-lg font-bold">Recent Activity</h3>
				<p className="text-sm text-primary">Latest account updates</p>
			</div>

			<div className="flex-1 overflow-y-auto px-6 pb-6">
				{!hasActivity ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
							<Clock className="w-6 h-6 text-muted-foreground" />
						</div>
						<p className="text-sm text-muted-foreground">No recent activity</p>
						<p className="text-xs text-muted-foreground mt-1">Activity will appear here once you add accounts</p>
					</div>
				) : (
					<div className="relative space-y-0">
						{activity.map((item, index) => {
							const { title, details, icon } = getActivityDetails(item);

							return (
								<div key={item.id} className="relative pl-10 pb-8 last:pb-0">
									{/* Connecting Line */}
									{index !== activity.length - 1 && (
										<div className="absolute left-[11px] top-2 -bottom-1 w-[2px] bg-border" />
									)}

									{/* Icon */}
									<div className="absolute left-0 top-1 z-10">
										{icon === "added" && (
											<div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
												<PlusCircle className="w-4 h-4" />
											</div>
										)}
										{icon === "updated" && (
											<div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
												<CheckCircle2 className="w-4 h-4" />
											</div>
										)}
										{icon === "deposit" && (
											<div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
												<ArrowDownLeft className="w-4 h-4" />
											</div>
										)}
										{icon === "withdrawal" && (
											<div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600">
												<ArrowUpRight className="w-4 h-4" />
											</div>
										)}
									</div>

									{/* Content */}
									<div className="flex flex-col gap-0.5">
										<div className="flex items-center justify-between">
											<h4 className="text-sm font-bold">{title}</h4>
											<span className="text-xs text-primary">{formatRelativeTime(item.timestamp)}</span>
										</div>
										<p className="text-sm font-medium text-primary/80">{item.accountName}</p>
										<p className="text-xs text-primary leading-relaxed">{details}</p>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</Card>
	);
}
