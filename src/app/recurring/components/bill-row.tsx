"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { accountWarning } from "@/lib/account-links";
import { formatAccountDisplayName } from "@/lib/account-utils";
import {
	calculateNextDueDate,
	differenceInDays,
	formatShortDate,
	getTodayDateString,
	parseLocalDate,
} from "@/lib/date-utils";
import { deleteRecurringExpense, markAsPaid, type RecurringExpense } from "../actions";
import { EditRecurringDialog } from "./edit-recurring-dialog";
import { PayFutureBillDialog } from "./pay-future-bill-dialog";
import type { AccountWithType } from "@/app/accounts/types";
import type { ProjectedFee } from "@/lib/overdraft";
import { RECURRING_GRID, RecurringAccountWarning, RecurringIdentity, RowMenu } from "./recurring-row-parts";

interface BillRowProps {
	bill: RecurringExpense;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
	timezone?: string | null;
	categoryOptions?: string[];
	accounts?: AccountWithType[];
	/** The fee this bill's next payment would charge its account. */
	feeWarning?: ProjectedFee | null;
}

function dueLabel(days: number): { text: string; tone: string } {
	if (days < 0)
		return { text: `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`, tone: "text-error" };
	if (days === 0) return { text: "Due today", tone: "text-warning" };
	if (days === 1) return { text: "Due tomorrow", tone: "text-muted-foreground" };
	return { text: `Due in ${days} days`, tone: "text-muted-foreground" };
}

/** One bill: when it's due, how much of this month is paid, and a Pay button. */
export function BillRow({
	bill,
	onDelete,
	onUpdate,
	timezone,
	categoryOptions = [],
	accounts = [],
	feeWarning = null,
}: BillRowProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isPayFutureOpen, setIsPayFutureOpen] = useState(false);

	const dueDate = parseLocalDate(bill.next_due_date);
	const today = parseLocalDate(getTodayDateString(timezone || undefined));
	const due = dueLabel(differenceInDays(dueDate, today));

	const isAutomated = (bill.meta_data as { is_automated?: boolean } | null)?.is_automated === true;
	const total = bill.occurrences_count || 0;
	const paid = bill.paid_count || 0;
	const isFullyPaid = paid >= (total || 1);
	const canPay = !isAutomated && !isFullyPaid;
	const account = accounts.find((a) => a.id === bill.account_id) ?? null;

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			if (await deleteRecurringExpense(bill.id)) {
				toast.success("Bill deleted", { description: "Transactions already recorded are kept." });
				onDelete?.(bill.id);
			} else {
				toast.error("Couldn't delete the bill", { description: "Try again in a moment." });
			}
		} catch (err) {
			toast.error("Couldn't delete the bill", { description: err instanceof Error ? err.message : undefined });
		} finally {
			setIsDeleting(false);
		}
	};

	const handlePay = async (event: React.MouseEvent) => {
		event.stopPropagation();
		const nextDate = calculateNextDueDate(new Date(bill.next_due_date), bill.billing_period);
		onUpdate?.(bill.id, {
			next_due_date: nextDate.toISOString(),
			paid_count: paid + 1,
			status: paid + 1 >= total ? "paid" : "partial",
		});
		try {
			if (await markAsPaid(bill.id)) toast.success(`${bill.name} marked as paid`);
			else toast.error("Couldn't record the payment", { description: "Try again in a moment." });
		} catch {
			toast.error("Couldn't record the payment", { description: "Try again in a moment." });
		} finally {
			router.refresh();
		}
	};

	const notes = Boolean(
		bill.next_amount_change ||
			bill.next_due_change ||
			bill.deleted_auto_payments ||
			(account && (accountWarning(account) || feeWarning))
	) && (
		<div className="type-body-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground row-wide:col-span-5 row-wide:mt-0 row-wide:pl-12">
			{bill.next_amount_change && (
				<span className="inline-flex items-center gap-1">
					Next amount{" "}
					<span className="line-through">{formatCurrency(bill.next_amount_change.from, { showCents: true })}</span>
					<ArrowRight className="h-3 w-3" aria-hidden />
					<span className="text-primary">{formatCurrency(bill.next_amount_change.to, { showCents: true })}</span>
				</span>
			)}
			{bill.next_due_change && (
				<span className="inline-flex items-center gap-1">
					Next date <span className="line-through">{formatShortDate(bill.next_due_change.from)}</span>
					<ArrowRight className="h-3 w-3" aria-hidden />
					<span className="text-primary">{formatShortDate(bill.next_due_change.to)}</span>
				</span>
			)}
			{bill.deleted_auto_payments ? (
				<span className="inline-flex items-center gap-1 text-warning">
					<AlertTriangle className="h-3 w-3" aria-hidden />A deleted automatic payment won&apos;t be recorded again
				</span>
			) : null}
			<RecurringAccountWarning account={account} fee={feeWarning} />
		</div>
	);

	return (
		<li>
			<div
				className={cn(RECURRING_GRID, "row-interactive cursor-pointer rounded-xl px-2 py-3 row-wide:px-3")}
				onClick={() => setIsEditOpen(true)}
			>
				<div className="flex items-center justify-between gap-3 row-wide:block">
					<RecurringIdentity expense={bill} automated={isAutomated} account={account} />
					<span className="type-value shrink-0 text-primary row-wide:hidden">
						{formatCurrency(Number(bill.amount), { showCents: true })}
					</span>
				</div>

				<div className="mt-2 flex items-center gap-2 pl-12 row-wide:mt-0 row-wide:block row-wide:pl-0">
					<p className="type-body-sm text-primary">{formatShortDate(dueDate)}</p>
					<p className={cn("type-body-xs", isFullyPaid ? "text-success" : due.tone)}>
						{isFullyPaid ? "Paid for this month" : due.text}
					</p>
				</div>

				<div className="mt-2 pl-12 row-wide:mt-0 row-wide:pl-0">
					{total > 0 ? (
						<div className="flex items-center gap-2 row-wide:block">
							<SegmentedProgress value={paid} total={total} className="max-w-[120px]" />
							<p className="type-body-xs shrink-0 text-muted-foreground row-wide:mt-1.5">
								{paid} of {total} paid this month
							</p>
						</div>
					) : (
						<p className="type-body-xs text-muted-foreground">Nothing due in this month&apos;s budget</p>
					)}
				</div>

				<p className="type-value hidden text-right text-primary row-wide:block">
					{formatCurrency(Number(bill.amount), { showCents: true })}
				</p>

				<div
					className="mt-2 flex items-center justify-end gap-1 row-wide:mt-0"
					onClick={(event) => event.stopPropagation()}
				>
					{canPay && total > 0 ? (
						<Button size="sm" onClick={handlePay} className="h-8 rounded-full px-4">
							Pay
						</Button>
					) : isFullyPaid && total > 0 ? (
						<span className="type-label inline-flex items-center gap-1 rounded-full bg-success-muted px-2.5 py-1 text-success">
							<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
							Paid
						</span>
					) : !isAutomated ? (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setIsPayFutureOpen(true)}
							className="h-8 rounded-full px-3 text-muted-foreground hover:text-primary"
						>
							Pay early
						</Button>
					) : null}
					<RowMenu
						name={bill.name}
						items={[
							{ label: "Edit", onSelect: () => setIsEditOpen(true) },
							...(!isAutomated ? [{ label: "Pay bills early", onSelect: () => setIsPayFutureOpen(true) }] : []),
						]}
						onDelete={() => setDeleteOpen(true)}
						deleting={isDeleting}
					/>
				</div>

				{notes}
			</div>

			<EditRecurringDialog
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
				expense={bill}
				onSuccess={(updated) => onUpdate?.(updated.id, updated)}
				categoryOptions={categoryOptions}
				accounts={accounts}
			/>
			<PayFutureBillDialog
				open={isPayFutureOpen}
				onOpenChange={setIsPayFutureOpen}
				expense={bill}
				onUpdate={onUpdate}
				onSuccess={() => router.refresh()}
				timezone={timezone}
				accountLabel={account ? formatAccountDisplayName(account) : null}
			/>
			<DeleteConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete ${bill.name}?`}
				description="Future payments stop. Transactions already recorded are kept."
				onConfirm={handleDelete}
			/>
		</li>
	);
}
