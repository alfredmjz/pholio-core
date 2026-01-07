"use client";

import { RecurringExpense, toggleSubscription, deleteRecurringExpense } from "../actions";
import { Switch } from "@/components/ui/switch";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceLogo } from "@/components/service-logo";
import { EditRecurringDialog } from "./edit-recurring-dialog";

interface SubscriptionRowProps {
	subscription: RecurringExpense;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
}

export function SubscriptionRow({ subscription, onDelete, onUpdate }: SubscriptionRowProps) {
	const [isActive, setIsActive] = useState(subscription.is_active ?? true);
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isReactivating, setIsReactivating] = useState(false);

	const handleToggle = async (checked: boolean) => {
		if (checked) {
			// Reactivation flow: Open dialog to confirm details
			setIsReactivating(true);
			setIsEditOpen(true);
			return;
		}

		// Deactivation flow: Standard toggle
		setIsActive(checked); // Optimistic update
		setIsLoading(true);
		try {
			const success = await toggleSubscription(subscription.id, checked);
			if (!success) {
				setIsActive(!checked); // Revert
				toast.error("Status Update Failed", {
					description: "Could not update subscription status. Please try again.",
				});
			} else {
				toast.success("Subscription paused");
			}
		} catch (err) {
			setIsActive(!checked);
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Update Error", {
				description: errorMessage,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const success = await deleteRecurringExpense(subscription.id);
			if (success) {
				toast.success("Subscription deleted");
				onDelete?.(subscription.id);
			} else {
				toast.error("Delete Failed", {
					description: "Could not delete subscription. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Delete Error", {
				description: errorMessage,
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const handleEditSuccess = (updated: RecurringExpense) => {
		onUpdate?.(updated.id, updated);
		if (updated.is_active) {
			setIsActive(true);
			setIsReactivating(false);
		}
	};

	return (
		<>
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
					<div className="hidden md:flex flex-col items-end mr-2">
						<span className="text-xs text-muted-foreground font-medium">Next Due</span>
						<span className="text-xs text-primary">
							{subscription.next_due_date ? formatShortDate(parseLocalDate(subscription.next_due_date)) : "N/A"}
						</span>
					</div>

					<Switch
						checked={isActive}
						onCheckedChange={handleToggle}
						disabled={isLoading || isDeleting}
						className={cn(
							"data-[state=checked]:bg-green-400",
							(isLoading || isDeleting) && "opacity-50 cursor-not-allowed"
						)}
					/>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8" disabled={isDeleting}>
								<MoreVertical className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => {
									setIsReactivating(false);
									setIsEditOpen(true);
								}}
							>
								Edit
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem className="text-error" onClick={handleDelete} disabled={isDeleting}>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<EditRecurringDialog
				open={isEditOpen}
				onOpenChange={(open) => {
					setIsEditOpen(open);
					if (!open) setIsReactivating(false);
				}}
				expense={subscription}
				onSuccess={handleEditSuccess}
				forceActiveOnSave={isReactivating}
			/>
		</>
	);
}
