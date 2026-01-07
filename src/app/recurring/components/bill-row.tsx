"use client";

import { RecurringExpense, deleteRecurringExpense, markAsPaid } from "../actions";
import { format } from "date-fns";
import { calculateNextDueDate, parseLocalDate } from "@/lib/date-utils";
import { MoreVertical, CalendarIcon, AlertCircle, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditRecurringDialog } from "./edit-recurring-dialog";

import { PayFutureBillDialog } from "./pay-future-bill-dialog";
import { CircularSegmentedProgress } from "@/components/ui/circular-segmented-progress";

interface BillRowProps {
	bill: RecurringExpense;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
}

export function BillRow({ bill, onDelete, onUpdate }: BillRowProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isPayFutureOpen, setIsPayFutureOpen] = useState(false);
	// Parse strictly as local date to prevent timezone shift (UTC -> Local)
	const dueDate = parseLocalDate(bill.next_due_date);

	const today = new Date();
	const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const isPastDue = todayZero > dueDate;
	const isDueToday = todayZero.getTime() === dueDate.getTime();

	// ... (handleDelete logic implemented)

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const success = await deleteRecurringExpense(bill.id);
			if (success) {
				toast.success("Bill deleted");
				onDelete?.(bill.id);
			} else {
				toast.error("Delete Failed", {
					description: "Could not delete bill. Please try again.",
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

	const handleMarkAsPaid = async (e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			toast.info("Processing manual payment...");

			// Optimistic Update
			const nextDate = calculateNextDueDate(new Date(bill.next_due_date), bill.billing_period);
			onUpdate?.(bill.id, {
				next_due_date: nextDate.toISOString(),
				paid_count: (bill.paid_count || 0) + 1,
				status: (bill.paid_count || 0) + 1 >= (bill.occurrences_count || 0) ? "paid" : "partial", // Simple heuristic
			});

			const success = await markAsPaid(bill.id);
			if (success) {
				toast.success("Marked as paid");
				router.refresh();
			} else {
				// Rollback? ideally useOptimisticRecurring handles rollback but we don't have direct access to it here easily without context
				toast.error("Action Failed", { description: "Could not mark as paid." });
				router.refresh(); // Sync back to server state
			}
		} catch (err) {
			toast.error("Error", { description: "An unexpected error occurred." });
		}
	};

	const handleEditSuccess = (updated: RecurringExpense) => {
		onUpdate?.(updated.id, updated);
	};

	return (
		<>
			<div className="grid grid-cols-[1fr_auto_auto_auto_12px] md:grid-cols-[minmax(0,1fr)_auto_auto_auto_40px] gap-4 items-center p-4 hover:bg-muted/30 transition-colors group">
				<div className="flex items-center gap-4 min-w-0">
					<div
						className={cn(
							"h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors bg-primary/10 text-primary"
						)}
					>
						{bill.name.substring(0, 2).toUpperCase()}
					</div>

					<div className="flex flex-col truncate">
						<span className="font-semibold text-sm truncate">{bill.name}</span>
						<span className="text-xs text-primary capitalize">{bill.billing_period}</span>
					</div>
				</div>

				{/* Amount & Due Date Stack */}
				<div className="flex flex-col items-end gap-0.5 text-right w-28">
					<span className="font-bold text-sm block">${Number(bill.amount).toFixed(2)}</span>
					<div
						className={cn(
							"flex items-center justify-end gap-1.5 text-xs",
							isPastDue ? "text-error font-medium" : isDueToday ? "text-warning font-medium" : "text-primary"
						)}
					>
						{isPastDue ? <AlertCircle className="w-3 h-3" /> : <CalendarIcon className="w-3 h-3" />}
						<span>{format(dueDate, "MMM d")}</span>
					</div>
				</div>

				{/* Circular Tracker */}
				<div className="flex justify-center w-16 px-1">
					{(bill.occurrences_count ?? 0) > 1 ? (
						<div
							className="flex items-center gap-2"
							title={`${bill.paid_count}/${bill.occurrences_count} paid this month`}
						>
							<CircularSegmentedProgress total={bill.occurrences_count!} current={bill.paid_count!} size={26} />
						</div>
					) : (
						<div className="w-[26px]" />
					)}
				</div>

				{/* Action / Status */}
				<div className="flex justify-end w-24">
					{(bill.meta_data as any)?.is_automated === false && (isPastDue || isDueToday) ? (
						<Button
							size="sm"
							variant="outline"
							className="h-7 hover:text-success rounded-md w-full"
							onClick={handleMarkAsPaid}
						>
							<CheckCircle className="w-3.5 h-3.5 mr-1" />
							Pay
						</Button>
					) : (
						<StatusBadge status={bill.status || (isPastDue ? "overdue" : isDueToday ? "due_today" : "upcoming")} />
					)}
				</div>

				<div className="flex justify-end">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8" disabled={isDeleting}>
								<MoreVertical className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{(bill.meta_data as any)?.is_automated === false && (
								<DropdownMenuItem onClick={() => setIsPayFutureOpen(true)}>Pay Future Bill</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={() => setIsEditOpen(true)}>Edit</DropdownMenuItem>
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
				onOpenChange={setIsEditOpen}
				expense={bill}
				onSuccess={handleEditSuccess}
			/>

			<PayFutureBillDialog
				open={isPayFutureOpen}
				onOpenChange={setIsPayFutureOpen}
				expense={bill}
				onUpdate={onUpdate}
				onSuccess={() => {
					router.refresh();
				}}
			/>
		</>
	);
}
