"use client";

import { Card } from "@/components/ui/card";
import { CheckCircle2, PlusCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
	id: string;
	title: string;
	subtitle: string;
	details: string;
	time: string;
	type: "updated" | "added" | "transferred";
}

const mockActivity: ActivityItem[] = [
	{
		id: "1",
		title: "Updated",
		subtitle: "Emergency Fund",
		details: "Deposited $500.00 via automatic transfer",
		time: "2:45 PM",
		type: "updated",
	},
	{
		id: "2",
		title: "Updated",
		subtitle: "Robinhood",
		details: "Portfolio value increased by $1,247.50",
		time: "11:30 AM",
		type: "updated",
	},
	{
		id: "3",
		title: "Account Added",
		subtitle: "TFSA",
		details: "New investment account created",
		time: "Yesterday",
		type: "added",
	},
	{
		id: "4",
		title: "Updated",
		subtitle: "Student Loans",
		details: "Payment of $450.00 processed",
		time: "Yesterday",
		type: "updated",
	},
];

export function RecentActivity() {
	return (
		<Card className="flex flex-col h-full bg-card border shadow-sm">
			<div className="p-6 pb-4">
				<h3 className="text-lg font-bold">Recent Activity</h3>
				<p className="text-sm text-muted-foreground">Latest account updates</p>
			</div>

			<div className="flex-1 overflow-y-auto px-6 pb-6">
				<div className="relative space-y-0">
					{mockActivity.map((item, index) => (
						<div key={item.id} className="relative pl-10 pb-8 last:pb-0">
							{/* Connecting Line */}
							{index !== mockActivity.length - 1 && (
								<div className="absolute left-[11px] top-2 -bottom-1 w-[2px] bg-border" />
							)}

							{/* Icon */}
							<div className="absolute left-0 top-1 z-10">
								{item.type === "updated" && (
									<div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
										<CheckCircle2 className="w-4 h-4" />
									</div>
								)}
								{item.type === "added" && (
									<div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600">
										<PlusCircle className="w-4 h-4" />
									</div>
								)}
								{item.type === "transferred" && (
									<div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600">
										<ArrowUpRight className="w-4 h-4" />
									</div>
								)}
							</div>

							{/* Content */}
							<div className="flex flex-col gap-0.5">
								<div className="flex items-center justify-between">
									<h4 className="text-sm font-bold">{item.title}</h4>
									<span className="text-xs text-muted-foreground">{item.time}</span>
								</div>
								<p className="text-sm font-medium text-foreground/80">{item.subtitle}</p>
								<p className="text-xs text-muted-foreground leading-relaxed">{item.details}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</Card>
	);
}
