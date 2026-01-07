import { useState, useMemo } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RecurringExpense, payRecurringExpense } from "../actions";
import { format } from "date-fns";
import { calculateNextDueDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PayFutureBillDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	expense: RecurringExpense;
	onSuccess?: () => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
}

export function PayFutureBillDialog({ open, onOpenChange, expense, onSuccess, onUpdate }: PayFutureBillDialogProps) {
	const [selectedCount, setSelectedCount] = useState(0);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Generate potential bills for the remainder of the current month
	const potentialBills = useMemo(() => {
		const bills = [];
		let currentDate = new Date(expense.next_due_date);
		const today = new Date();
		const currentMonth = today.getMonth();
		const currentYear = today.getFullYear();

		// Safety cap of 12, but rely on month check
		for (let i = 0; i < 12; i++) {
			// Stop if we've crossed into the next month relative to TODAY
			if (currentDate.getMonth() !== currentMonth || currentDate.getFullYear() !== currentYear) {
				break;
			}

			bills.push({
				index: i,
				date: new Date(currentDate),
				amount: Number(expense.amount),
			});
			currentDate = calculateNextDueDate(currentDate, expense.billing_period);
		}
		return bills;
	}, [expense]);

	const handleRowClick = (index: number) => {
		// Enforce contiguous selection from start
		if (selectedCount === index + 1) {
			// Deselect this one (and all after, effectively)
			setSelectedCount(index);
		} else {
			// Select up to this one
			setSelectedCount(index + 1);
		}
	};

	const totalAmount = selectedCount * Number(expense.amount);
	const nextDueDate =
		selectedCount > 0
			? calculateNextDueDate(potentialBills[selectedCount - 1].date, expense.billing_period)
			: potentialBills.length > 0
				? potentialBills[0].date
				: new Date(expense.next_due_date);

	const handlePay = async () => {
		if (selectedCount === 0) return;

		setIsSubmitting(true);

		// Optimistic Update
		onUpdate?.(expense.id, {
			next_due_date: nextDueDate.toISOString(),
			paid_count: (expense.paid_count || 0) + selectedCount,
		});

		try {
			const success = await payRecurringExpense(expense.id, selectedCount);
			if (success) {
				toast.success(`Successfully paid ${selectedCount} bill(s)`);
				onOpenChange(false);
				onSuccess?.();
				setSelectedCount(0);
			} else {
				toast.error("Payment Failed", {
					description: "Could not process the future payments.",
				});
			}
		} catch (err) {
			toast.error("Error", {
				description: "An unexpected error occurred.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Pay Future Bills</DialogTitle>
					<DialogDescription>Select upcoming bills to pay in advance.</DialogDescription>
				</DialogHeader>

				<div className="py-4 space-y-4">
					<div className="border border-border rounded-md overflow-hidden">
						<div className="grid grid-cols-2 bg-muted/50 p-2 text-xs font-medium text-muted-foreground">
							<div>Due Date</div>
							<div className="text-right">Amount</div>
						</div>
						<div className="max-h-[300px] overflow-y-auto">
							{potentialBills.map((bill, i) => {
								const isSelected = i < selectedCount;
								return (
									<div
										key={i}
										onClick={() => handleRowClick(i)}
										className={cn(
											"grid grid-cols-2 p-3 text-sm cursor-pointer transition-colors border-t border-border/50",
											isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"
										)}
									>
										<div className="flex items-center gap-2">
											<div
												className={cn(
													"w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
													isSelected
														? "bg-primary border-primary text-primary-foreground"
														: "border-muted-foreground/30"
												)}
											>
												{isSelected && <Check className="w-2.5 h-2.5" />}
											</div>
											<span className={cn(isSelected && "font-medium")}>{format(bill.date, "MMM d, yyyy")}</span>
										</div>
										<div className={cn("text-right", isSelected && "font-medium")}>${bill.amount.toFixed(2)}</div>
									</div>
								);
							})}
						</div>
					</div>

					{potentialBills.length === 0 ? (
						<div className="text-center py-6 text-muted-foreground text-sm">No more bills due this month!</div>
					) : (
						selectedCount > 0 && (
							<div className="rounded-md bg-muted/50 p-4 text-sm space-y-2 animate-in fade-in slide-in-from-top-1 duration-200 border border-border/50 shadow-sm mx-auto w-full max-w-[350px]">
								<div className="flex justify-between items-center">
									<span className="text-muted-foreground">Bills selected:</span>
									<div className="flex items-center justify-center w-6 h-6 bg-background rounded-md border">
										<span className="font-medium text-xs">{selectedCount}</span>
									</div>
								</div>
								<div className="flex justify-between items-center">
									<span className="text-muted-foreground">Total Amount:</span>
									<span className="font-bold text-lg text-primary">${totalAmount.toFixed(2)}</span>
								</div>
								<div className="flex justify-between items-center pt-2 border-t border-border/50 mt-2">
									<span className="text-muted-foreground">New Next Due Date:</span>
									<span className="font-medium text-primary">{format(nextDueDate, "MMM d, yyyy")}</span>
								</div>
							</div>
						)
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={handlePay} disabled={selectedCount === 0 || isSubmitting}>
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Pay {selectedCount > 0 && `$${totalAmount.toFixed(2)}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
