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
import {
	calculateNextDueDate,
	differenceInDays,
	formatShortDate,
	getTodayDateString,
	parseLocalDate,
} from "@/lib/date-utils";
import { deleteRecurringExpense, markAsPaid, type RecurringExpense } from "../actions";
import { EditRecurringDialog } from "./edit-recurring-dialog";
import type { AccountWithType } from "@/app/accounts/types";
import type { ProjectedFee } from "@/lib/overdraft";
import { RECURRING_GRID, RecurringAccountWarning, RecurringIdentity, RowMenu } from "./recurring-row-parts";

interface TransferRowProps {
	transfer: RecurringExpense;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
	timezone?: string | null;
	accounts?: AccountWithType[];
	/** The fee this transfer's next run would charge the account it comes from. */
	feeWarning?: ProjectedFee | null;
}

function dueLabel(days: number): { text: string; tone: string } {
	if (days < 0) return { text: `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} late`, tone: "text-error" };
	if (days === 0) return { text: "Today", tone: "text-warning" };
	if (days === 1) return { text: "Tomorrow", tone: "text-muted-foreground" };
	return { text: `In ${days} days`, tone: "text-muted-foreground" };
}

/** One recurring transfer: which accounts, when it next runs, this month's progress, and a Transfer button. */
export function TransferRow({
	transfer,
	onDelete,
	onUpdate,
	timezone,
	accounts = [],
	feeWarning = null,
}: TransferRowProps) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);

	const dueDate = parseLocalDate(transfer.next_due_date);
	const today = parseLocalDate(getTodayDateString(timezone || undefined));
	const due = dueLabel(differenceInDays(dueDate, today));

	const isAutomated = (transfer.meta_data as { is_automated?: boolean } | null)?.is_automated !== false;
	const total = transfer.occurrences_count || 0;
	const done = transfer.paid_count || 0;
	const isDone = done >= (total || 1);
	const fromAccount = accounts.find((a) => a.id === transfer.account_id) ?? null;
	const toAccount = accounts.find((a) => a.id === transfer.to_account_id) ?? null;
	const accountsReady = Boolean(fromAccount && toAccount);
	const canTransfer = accountsReady && !isAutomated && !isDone && total > 0;

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const result = await deleteRecurringExpense(transfer.id);
			if (result.ok) {
				toast.success("Transfer deleted", { description: "Transfers already recorded are kept." });
				onDelete?.(transfer.id);
			} else {
				toast.error("Couldn't delete the transfer", { description: result.error.message });
			}
		} catch (err) {
			toast.error("Couldn't delete the transfer", { description: err instanceof Error ? err.message : undefined });
		} finally {
			setIsDeleting(false);
		}
	};

	const handleTransfer = async (event: React.MouseEvent) => {
		event.stopPropagation();
		const nextDate = calculateNextDueDate(new Date(transfer.next_due_date), transfer.billing_period);
		onUpdate?.(transfer.id, {
			next_due_date: nextDate.toISOString(),
			paid_count: done + 1,
			status: done + 1 >= total ? "paid" : "partial",
		});
		try {
			const result = await markAsPaid(transfer.id);
			if (result.ok) toast.success(`${transfer.name} recorded`);
			else toast.error("Couldn't record the transfer", { description: result.error.message });
		} catch {
			toast.error("Couldn't record the transfer", { description: "Try again in a moment." });
		} finally {
			router.refresh();
		}
	};

	const notes = Boolean(
		!accountsReady ||
		transfer.next_amount_change ||
		transfer.next_due_change ||
		transfer.deleted_auto_payments ||
		(fromAccount && feeWarning)
	) && (
		<div className="type-body-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground row-wide:col-span-5 row-wide:mt-0 row-wide:pl-12">
			{!accountsReady && (
				<span className="inline-flex items-center gap-1 text-warning">
					<AlertTriangle className="h-3 w-3" aria-hidden />
					One of its accounts was closed or deleted. Edit it and pick both accounts to restart it.
				</span>
			)}
			{transfer.next_amount_change && (
				<span className="inline-flex items-center gap-1">
					Next amount{" "}
					<span className="line-through">{formatCurrency(transfer.next_amount_change.from, { showCents: true })}</span>
					<ArrowRight className="h-3 w-3" aria-hidden />
					<span className="text-primary">{formatCurrency(transfer.next_amount_change.to, { showCents: true })}</span>
				</span>
			)}
			{transfer.next_due_change && (
				<span className="inline-flex items-center gap-1">
					Next date <span className="line-through">{formatShortDate(transfer.next_due_change.from)}</span>
					<ArrowRight className="h-3 w-3" aria-hidden />
					<span className="text-primary">{formatShortDate(transfer.next_due_change.to)}</span>
				</span>
			)}
			{transfer.deleted_auto_payments ? (
				<span className="inline-flex items-center gap-1 text-warning">
					<AlertTriangle className="h-3 w-3" aria-hidden />A deleted automatic transfer won&apos;t be recorded again
				</span>
			) : null}
			<RecurringAccountWarning account={fromAccount} fee={feeWarning} />
		</div>
	);

	return (
		<li>
			<div
				className={cn(RECURRING_GRID, "row-interactive cursor-pointer rounded-xl px-2 py-3 row-wide:px-3")}
				onClick={() => setIsEditOpen(true)}
			>
				<div className="flex items-center justify-between gap-3 row-wide:block">
					<RecurringIdentity
						expense={transfer}
						automated={isAutomated}
						account={fromAccount}
						toAccount={toAccount}
						muted={!accountsReady}
					/>
					<span className="type-value shrink-0 text-primary row-wide:hidden">
						{formatCurrency(Number(transfer.amount), { showCents: true })}
					</span>
				</div>

				<div className="mt-2 flex items-center gap-2 pl-12 row-wide:mt-0 row-wide:block row-wide:pl-0">
					<p className="type-body-sm text-primary">{formatShortDate(dueDate)}</p>
					<p className={cn("type-body-xs", isDone ? "text-success" : due.tone)}>
						{isDone ? "Done for this month" : due.text}
					</p>
				</div>

				<div className="mt-2 pl-12 row-wide:mt-0 row-wide:pl-0">
					{total > 0 ? (
						<div className="flex items-center gap-2 row-wide:block">
							<SegmentedProgress value={done} total={total} className="max-w-[120px]" />
							<p className="type-body-xs shrink-0 text-muted-foreground row-wide:mt-1.5">
								{done} of {total} done this month
							</p>
						</div>
					) : (
						<p className="type-body-xs text-muted-foreground">None due this month</p>
					)}
				</div>

				<p className="type-value hidden text-right text-primary row-wide:block">
					{formatCurrency(Number(transfer.amount), { showCents: true })}
				</p>

				<div
					className="mt-2 flex items-center justify-end gap-1 row-wide:mt-0"
					onClick={(event) => event.stopPropagation()}
				>
					{canTransfer ? (
						<Button size="sm" onClick={handleTransfer} className="h-8 rounded-full px-4">
							Transfer
						</Button>
					) : isDone && total > 0 ? (
						<span className="type-label inline-flex items-center gap-1 rounded-full bg-success-muted px-2.5 py-1 text-success">
							<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
							Done
						</span>
					) : null}
					<RowMenu
						name={transfer.name}
						items={[{ label: "Edit", onSelect: () => setIsEditOpen(true) }]}
						onDelete={() => setDeleteOpen(true)}
						deleting={isDeleting}
					/>
				</div>

				{notes}
			</div>

			<EditRecurringDialog
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
				expense={transfer}
				onSuccess={(updated) => onUpdate?.(updated.id, updated)}
				accounts={accounts}
			/>
			<DeleteConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete ${transfer.name}?`}
				description="Future transfers stop. Transfers already recorded are kept."
				onConfirm={handleDelete}
			/>
		</li>
	);
}
