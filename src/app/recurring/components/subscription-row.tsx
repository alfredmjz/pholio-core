"use client";

import { RecurringExpense, toggleSubscription } from "../actions";
import { Switch } from "@/components/ui/switch";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceLogo } from "@/components/service-logo";

interface SubscriptionRowProps {
	subscription: RecurringExpense;
}

export function SubscriptionRow({ subscription }: SubscriptionRowProps) {
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
		<div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
			<div className="flex items-center gap-4">
				<div className="h-10 w-10 flex-shrink-0">
					<ServiceLogo
						name={subscription.name}
						serviceProvider={subscription.service_provider}
						domain={(subscription.meta_data as any)?.domain}
						className="w-10 h-10"
						width={40}
						height={40}
						disableLookup={(subscription.meta_data as any)?.no_logo_lookup}
					/>
				</div>
				<div className="flex flex-col">
					<span className="font-semibold text-sm">{subscription.name}</span>
					<span className="text-xs text-primary">
						${Number(subscription.amount).toFixed(2)} / {subscription.billing_period}
					</span>
				</div>
			</div>

			<div className="flex items-center gap-4">
				<Switch
					checked={isActive}
					onCheckedChange={handleToggle}
					disabled={isLoading}
					className={cn("data-[state=checked]:bg-green-400", isLoading && "opacity-50 cursor-not-allowed")}
				/>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<MoreVertical className="h-4 w-4" />
							<span className="sr-only">Open menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => toast.info("Edit functionality coming soon")}>Edit</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem className="text-error" onClick={() => toast.info("Delete functionality coming soon")}>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
