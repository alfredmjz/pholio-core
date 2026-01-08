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
import { Card, CardContent } from "@/components/ui/card";

interface SubscriptionCardProps {
	subscription: RecurringExpense;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
}

export function SubscriptionCard({ subscription, onDelete, onUpdate }: SubscriptionCardProps) {
	const [isActive, setIsActive] = useState(subscription.is_active ?? true);
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isReactivating, setIsReactivating] = useState(false);

	const handleToggle = async (checked: boolean) => {
		if (checked) {
			setIsReactivating(true);
			setIsEditOpen(true);
			return;
		}

		setIsActive(checked);
		setIsLoading(true);
		try {
			const success = await toggleSubscription(subscription.id, checked);
			if (!success) {
				setIsActive(!checked);
				toast.error("Status Update Failed");
			} else {
				toast.success("Subscription paused");
			}
		} catch (err) {
			setIsActive(!checked);
			toast.error("Update Error");
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
				toast.error("Delete Failed");
			}
		} catch (err) {
			toast.error("Delete Error");
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

	const nextDueDate = subscription.next_due_date ? formatShortDate(parseLocalDate(subscription.next_due_date)) : "N/A";

	return (
		<>
			<Card className="group relative transition-all duration-200 hover:shadow-md hover:border-primary hover:ring-1 hover:ring-primary border-border/60">
				<CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
					<div className="flex items-center gap-5">
						<div className="h-14 w-14 flex-shrink-0 shadow-sm rounded-xl overflow-hidden ">
							<ServiceLogo
								name={subscription.name}
								serviceProvider={subscription.service_provider}
								domain={(subscription.meta_data as any)?.domain}
								className="w-14 h-14"
								width={56}
								height={56}
								disableLookup={(subscription.meta_data as any)?.no_logo_lookup}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<h3 className="font-bold text-lg leading-none tracking-tight">{subscription.name}</h3>
							<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								<span>{subscription.billing_period}</span>
								<span>•</span>
								<span className="flex items-center gap-1">{nextDueDate}</span>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 w-full sm:w-auto">
						<div className="flex flex-col items-end gap-0.5">
							<span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">AMOUNT</span>
							<span className="text-3xl font-bold tracking-tighter">${Number(subscription.amount).toFixed(2)}</span>
						</div>

						<div className="flex items-center gap-4">
							<Switch
								checked={isActive}
								onCheckedChange={handleToggle}
								disabled={isLoading || isDeleting}
								className={cn("data-[state=checked]:bg-green-500", (isLoading || isDeleting) && "opacity-50")}
							/>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
									>
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
				</CardContent>
			</Card>
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
