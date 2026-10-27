"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { formatFullDate, formatShortDate, getTodayDateString } from "@/lib/date-utils";
import { formatMoney } from "@/lib/format";
import { RecurringExpense, payRecurringExpense } from "../actions";
import { earlyPaymentPlan, PAY_AHEAD_MONTHS, upcomingOccurrences } from "../recurring-schedule";

/** Up to this many covered bills are each shown; more show as first → last. */
const CHIP_LIMIT = 4;
const CHIP_CLASS = "type-body-xs rounded-full border border-border bg-card px-2.5 py-1 tabular-nums text-primary";

interface PayFutureBillDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	expense: RecurringExpense;
	onSuccess?: () => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
	timezone?: string | null;
	/** The account the bill is paid from, named in the description. */
	accountLabel?: string | null;
}

/**
 * Pays the next few bills now. Each one is recorded today, the day the money leaves, and the due
 * date moves past the bills covered.
 */
export function PayFutureBillDialog({
	open,
	onOpenChange,
	expense,
	onSuccess,
	onUpdate,
	timezone,
	accountLabel,
}: PayFutureBillDialogProps) {
	const [count, setCount] = useState(1);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (open) setCount(1);
	}, [open]);

	const today = getTodayDateString(timezone || undefined);
	const available = useMemo(
		() => upcomingOccurrences(expense.next_due_date, expense.billing_period, today).length,
		[expense.next_due_date, expense.billing_period, today]
	);
	const plan = earlyPaymentPlan(expense.next_due_date, expense.billing_period, Math.min(count, Math.max(available, 1)));
	const total = count * Number(expense.amount);
	const thisYear = today.slice(0, 4);
	const dueLabel = (date: string) => (date.startsWith(thisYear) ? formatShortDate(date) : formatFullDate(date));
	// A long run shows only its first and last due dates, so the dialog keeps its height at any count.
	const covered = plan.covered;
	const isLongRun = covered.length > CHIP_LIMIT;

	const handlePay = async () => {
		if (available === 0 || isSubmitting) return;
		setIsSubmitting(true);
		onUpdate?.(expense.id, { next_due_date: plan.nextDue, paid_count: (expense.paid_count || 0) + count });

		try {
			if (await payRecurringExpense(expense.id, count, { early: true })) {
				toast.success(`Paid ${count} ${count === 1 ? "bill" : "bills"} early`, {
					description: `Next one is due ${formatFullDate(plan.nextDue)}.`,
				});
				onOpenChange(false);
				onSuccess?.();
			} else {
				toast.error("Couldn't record the payment", { description: "Try again in a moment." });
			}
		} catch {
			toast.error("Couldn't record the payment", { description: "Try again in a moment." });
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Pay bills early"
			description={`Recorded today, ${formatFullDate(today)}${accountLabel ? `, from ${accountLabel}` : ""}.`}
			className="sm:max-w-[440px]"
			onEnterSubmit={handlePay}
		>
			{available === 0 ? (
				<p className="type-body-sm py-6 text-center text-muted-foreground">
					Nothing is due in the next {PAY_AHEAD_MONTHS} months.
				</p>
			) : (
				<div className="flex flex-col gap-5 py-2">
					<div className="flex items-center justify-between gap-4">
						<div className="min-w-0">
							<p id="early-count-label" className="type-label text-primary">
								Bills to pay
							</p>
							<p className="type-body-xs text-muted-foreground">
								Up to {available} in the next {PAY_AHEAD_MONTHS} months
							</p>
						</div>
						<div
							role="group"
							aria-labelledby="early-count-label"
							className="flex shrink-0 items-center rounded-full border border-border"
						>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-11 w-11 rounded-full sm:h-9 sm:w-9"
								onClick={() => setCount((n) => Math.max(1, n - 1))}
								disabled={count <= 1}
								aria-label="One fewer bill"
							>
								<Minus className="h-4 w-4" />
							</Button>
							<span className="type-value w-8 text-center tabular-nums text-primary" aria-live="polite">
								{count}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-11 w-11 rounded-full sm:h-9 sm:w-9"
								onClick={() => setCount((n) => Math.min(available, n + 1))}
								disabled={count >= available}
								aria-label="One more bill"
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="rounded-2xl border border-border bg-card-muted/50 p-4">
						<p className="type-body-xs text-muted-foreground">
							{isLongRun ? `Covers ${covered.length} bills due from` : "Covers the bills due"}
						</p>
						{isLongRun ? (
							<p
								className="mt-2 flex flex-wrap items-center gap-1.5"
								aria-label={`From ${formatFullDate(covered[0])} to ${formatFullDate(covered[covered.length - 1])}`}
							>
								<span className={CHIP_CLASS}>{formatFullDate(covered[0])}</span>
								<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
								<span className={CHIP_CLASS}>{formatFullDate(covered[covered.length - 1])}</span>
							</p>
						) : (
							<ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Bills covered">
								{covered.map((date) => (
									<li key={date} className={CHIP_CLASS}>
										{dueLabel(date)}
									</li>
								))}
							</ul>
						)}
						<dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
							<div>
								<dt className="type-body-xs text-muted-foreground">Paid today</dt>
								<dd className="type-value text-primary">{formatMoney(total, { showCents: true })}</dd>
							</div>
							<div>
								<dt className="type-body-xs text-muted-foreground">Next bill due</dt>
								<dd className="type-body-sm mt-0.5 text-primary">{formatFullDate(plan.nextDue)}</dd>
							</div>
						</dl>
					</div>
				</div>
			)}

			<DialogFooter>
				<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
					Cancel
					<CancelShortcut />
				</Button>
				<Button onClick={handlePay} disabled={available === 0 || isSubmitting}>
					{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					Pay {formatMoney(total, { showCents: true })}
					<SubmitShortcut />
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
