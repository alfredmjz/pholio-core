"use client";

import { RecurringExpense, toggleSubscription } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, CreditCard, ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SubscriptionCardProps {
	subscription: RecurringExpense;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
	const [isActive, setIsActive] = useState(subscription.is_active ?? true);
	const [isLoading, setIsLoading] = useState(false);

	const handleToggle = async (checked: boolean) => {
		setIsActive(checked); // Optimistic update
		setIsLoading(true);
		try {
			const success = await toggleSubscription(subscription.id, checked);
			if (!success) {
				setIsActive(!checked); // Revert
				toast.error("Failed to update subscription status");
			} else {
				toast.success(checked ? "Subscription active" : "Subscription paused");
			}
		} catch (error) {
			setIsActive(!checked);
			toast.error("An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className="overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30">
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
						{/* Placeholder Icon - Future: Logic to map service_provider to real logos */}
						<CreditCard className="h-4 w-4 text-primary" />
					</div>
					<CardTitle className="text-base font-semibold truncate max-w-[120px]" title={subscription.name}>
						{subscription.name}
					</CardTitle>
				</div>
				<Switch checked={isActive} onCheckedChange={handleToggle} disabled={isLoading} />
			</CardHeader>
			<CardContent className="pt-4">
				<div className="flex justify-between items-baseline mb-2">
					<span className="text-2xl font-bold">${Number(subscription.amount).toFixed(2)}</span>
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="capitalize text-xs">
							{subscription.billing_period}
						</Badge>
						<StatusBadge status={subscription.status || "upcoming"} />
					</div>
				</div>
				<div className="flex items-center text-xs text-primary gap-1">
					<Calendar className="h-3 w-3" />
					Due: {new Date(subscription.next_due_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
				</div>
			</CardContent>
		</Card>
	);
}
