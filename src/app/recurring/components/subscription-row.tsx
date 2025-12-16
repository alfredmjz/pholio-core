"use client";

import { RecurringExpense, toggleSubscription } from "../actions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CreditCard, MoreVertical, Check } from "lucide-react";
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
        <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors border-b last:border-0">
        <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                     {/* Placeholder Icon - Future: Logic to map service_provider to real logos */}
                    <span className="font-bold text-primary text-sm">{subscription.name.substring(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">{subscription.name}</span>
                    <span className="text-xs text-muted-foreground">
                        ${Number(subscription.amount).toFixed(2)} / {subscription.billing_period}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(!isActive)}
                        disabled={isLoading}
                        className={cn(
                            "rounded-full h-7 px-3 text-xs font-medium border transition-colors",
                            isActive
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/25 hover:text-emerald-600"
                                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                    >
                        {isActive && <Check className="w-3 h-3 mr-1.5" />}
                        {isActive ? "Enabled" : "Disabled"}
                    </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => toast.info("Edit functionality coming soon")}>
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => toast.info("Delete functionality coming soon")}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
