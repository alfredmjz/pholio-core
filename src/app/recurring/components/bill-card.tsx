import { RecurringExpense, deleteRecurringExpense, markAsPaid } from "../actions";
import { format } from "date-fns";
import { calculateNextDueDate, parseLocalDate } from "@/lib/date-utils";
import { CalendarIcon, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditRecurringDialog } from "./edit-recurring-dialog";

import { PayFutureBillDialog } from "./pay-future-bill-dialog";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { BillCardHeader } from "./bill-card-header";
import { SegmentedProgress } from "@/components/ui/segmented-progress";

interface BillCardProps {
	bill: RecurringExpense;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
}

export function BillCard({ bill, onDelete, onUpdate }: BillCardProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isPayFutureOpen, setIsPayFutureOpen] = useState(false);

	const dueDate = parseLocalDate(bill.next_due_date);

	const today = new Date();
	const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const isPastDue = todayZero > dueDate;
	const isDueToday = todayZero.getTime() === dueDate.getTime();

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const success = await deleteRecurringExpense(bill.id);
			if (success) {
				toast.success("Bill deleted");
				onDelete?.(bill.id);
			} else {
				toast.error("Delete Failed");
			}
		} catch (err) {
			toast.error("Delete Error", {
				description: err instanceof Error ? err.message : "Unknown error",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	const handleMarkAsPaid = async (e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			toast.info("Processing payment...");

			const nextDate = calculateNextDueDate(new Date(bill.next_due_date), bill.billing_period);
			onUpdate?.(bill.id, {
				next_due_date: nextDate.toISOString(),
				paid_count: (bill.paid_count || 0) + 1,
				status: (bill.paid_count || 0) + 1 >= (bill.occurrences_count || 0) ? "paid" : "partial",
			});

			const success = await markAsPaid(bill.id);
			if (success) {
				toast.success("Marked as paid");
				router.refresh();
			} else {
				toast.error("Action Failed");
				router.refresh();
			}
		} catch (err) {
			toast.error("Error", { description: "An unexpected error occurred." });
		}
	};

	const handleEditSuccess = (updated: RecurringExpense) => {
		onUpdate?.(updated.id, updated);
	};

	const isAutomated = (bill.meta_data as any)?.is_automated === true;
	const isFullyPaid = (bill.paid_count || 0) >= (bill.occurrences_count || 1);
	const canPay = !isAutomated && !isFullyPaid;
	const total = Math.max(bill.occurrences_count || 1, 1);
	const current = bill.paid_count || 0;

	return (
		<>
			<Card className="group relative transition-all duration-200 hover:shadow-md hover:border-primary hover:ring-1 hover:ring-primary border-border/60">
				<BillCardHeader
					bill={bill}
					isAutomated={isAutomated}
					isDeleting={isDeleting}
					onPayFuture={() => setIsPayFutureOpen(true)}
					onEdit={() => setIsEditOpen(true)}
					onDelete={handleDelete}
				/>

				<CardContent className="p-5 pt-4 pb-4">
					<div className="mb-4">
						<span className="text-2xl font-bold tracking-tight">${Number(bill.amount).toFixed(2)}</span>
					</div>

					<div className="flex items-center justify-between">
						<div
							className={cn(
								"flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors",
								isPastDue
									? "bg-error/10 text-error"
									: isDueToday
										? "bg-warning/10 text-warning"
										: "bg-muted text-muted-foreground"
							)}
						>
							<CalendarIcon className="w-3.5 h-3.5" />
							<span>{format(dueDate, "MMM d")}</span>
						</div>

						{isAutomated && (
							<div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70 bg-muted/50 px-2 py-1 rounded-full">
								<Zap className="w-3 h-3 fill-current" /> Auto
							</div>
						)}
					</div>
				</CardContent>

				<CardFooter className="p-5 pt-0 flex flex-col gap-3">
					<div className="w-full h-px bg-border/40" />

					<div className="flex items-center justify-between w-full h-9">
						<div className="flex flex-col justify-center gap-1.5">
							<SegmentedProgress value={current} total={total} />
							<span className="text-[10px] font-medium text-muted-foreground ml-0.5">
								{current} of {total} paid
							</span>
						</div>

						<div>
							{canPay ? (
								<Button
									size="sm"
									onClick={handleMarkAsPaid}
									className="h-8 px-4 text-xs font-semibold shadow-sm rounded-full"
								>
									Pay
								</Button>
							) : isFullyPaid ? (
								<div className="flex items-center gap-1.5 text-success text-xs font-semibold px-3 py-1 bg-success/10 rounded-full">
									<CheckCircle2 className="w-3.5 h-3.5" />
									<span>Paid</span>
								</div>
							) : null}
						</div>
					</div>
				</CardFooter>
			</Card>
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
				onSuccess={() => router.refresh()}
			/>
		</>
	);
}
