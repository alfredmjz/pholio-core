"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { accountWarning } from "@/lib/account-links";
import { differenceInDays, formatShortDate, getTodayDateString, parseLocalDate } from "@/lib/date-utils";
import { deleteRecurringExpense, toggleSubscription, type RecurringExpense } from "../actions";
import { monthlyEquivalent, parsePeriod } from "../recurring-schedule";
import { EditRecurringDialog } from "./edit-recurring-dialog";
import type { AccountWithType } from "@/app/accounts/types";
import type { ProjectedFee } from "@/lib/overdraft";
import { RECURRING_GRID, RecurringAccountWarning, RecurringIdentity, RowMenu } from "./recurring-row-parts";

interface SubscriptionRowProps {
	subscription: RecurringExpense;
	timezone?: string | null;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, updates: Partial<RecurringExpense>) => void;
	categoryOptions?: string[];
	accounts?: AccountWithType[];
	/** The fee this subscription's next payment would charge its account. */
	feeWarning?: ProjectedFee | null;
}

/** One subscription: when it renews, what it costs, and an on/off switch. */
export function SubscriptionRow({
	subscription,
	timezone,
	onDelete,
	onUpdate,
	categoryOptions = [],
	accounts = [],
	feeWarning = null,
}: SubscriptionRowProps) {
	const [isActive, setIsActive] = useState(subscription.is_active ?? true);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isReactivating, setIsReactivating] = useState(false);

	const handleToggle = async (checked: boolean) => {
		// Turning it back on goes through the edit dialog, so the next date can be set first.
		if (checked) {
			setIsReactivating(true);
			setIsEditOpen(true);
			return;
		}
		setIsActive(false);
		setIsSaving(true);
		try {
			if (await toggleSubscription(subscription.id, false)) {
				toast.success(`${subscription.name} paused`, {
					description: "Future payments stop. Transactions already recorded are kept.",
				});
			} else {
				setIsActive(true);
				toast.error("Couldn't pause the subscription", { description: "Try again in a moment." });
			}
		} catch {
			setIsActive(true);
			toast.error("Couldn't pause the subscription", { description: "Try again in a moment." });
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			if (await deleteRecurringExpense(subscription.id)) {
				toast.success("Subscription deleted", { description: "Transactions already recorded are kept." });
				onDelete?.(subscription.id);
			} else {
				toast.error("Couldn't delete the subscription", { description: "Try again in a moment." });
			}
		} catch {
			toast.error("Couldn't delete the subscription", { description: "Try again in a moment." });
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

	const amount = Number(subscription.amount);
	const account = accounts.find((a) => a.id === subscription.account_id) ?? null;
	const daysUntil = differenceInDays(
		parseLocalDate(subscription.next_due_date),
		parseLocalDate(getTodayDateString(timezone || undefined))
	);
	const isMonthly = (() => {
		const { value, unit } = parsePeriod(subscription.billing_period);
		return value === 1 && unit === "months";
	})();

	return (
		<li>
			<div
				className={cn(RECURRING_GRID, "row-interactive cursor-pointer rounded-xl px-2 py-3 row-wide:px-3")}
				onClick={() => {
					setIsReactivating(false);
					setIsEditOpen(true);
				}}
			>
				<div className="flex items-center justify-between gap-3 row-wide:block">
					<RecurringIdentity expense={subscription} muted={!isActive} account={account} />
					<span className="type-value shrink-0 text-primary row-wide:hidden">
						{formatCurrency(amount, { showCents: true })}
					</span>
				</div>

				<div className="mt-2 pl-12 row-wide:mt-0 row-wide:pl-0">
					{isActive ? (
						<>
							<p className="type-body-sm text-primary">{formatShortDate(parseLocalDate(subscription.next_due_date))}</p>
							<p className={cn("type-body-xs", daysUntil < 0 ? "text-error" : "text-muted-foreground")}>
								{daysUntil < 0
									? `${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? "day" : "days"} overdue`
									: daysUntil === 0
										? "Due today"
										: "Next payment"}
							</p>
						</>
					) : (
						<>
							<p className="type-body-sm text-warning">Paused</p>
							<p className="type-body-xs text-muted-foreground">No future payments</p>
						</>
					)}
				</div>

				<div className="hidden row-wide:block">
					{!isMonthly && (
						<p className="type-body-xs text-muted-foreground">
							About {formatCurrency(monthlyEquivalent(amount, subscription.billing_period), { showCents: true })} a
							month
						</p>
					)}
				</div>

				<p className="type-value hidden text-right text-primary row-wide:block">
					{formatCurrency(amount, { showCents: true })}
				</p>

				<div
					className="mt-2 flex items-center justify-end gap-2 row-wide:mt-0"
					onClick={(event) => event.stopPropagation()}
				>
					<Switch
						checked={isActive}
						onCheckedChange={handleToggle}
						disabled={isSaving || isDeleting}
						aria-label={isActive ? `Pause ${subscription.name}` : `Turn ${subscription.name} back on`}
					/>
					<RowMenu
						name={subscription.name}
						items={[
							{
								label: "Edit",
								onSelect: () => {
									setIsReactivating(false);
									setIsEditOpen(true);
								},
							},
						]}
						onDelete={() => setDeleteOpen(true)}
						deleting={isDeleting}
					/>
				</div>

				{subscription.deleted_auto_payments ? (
					<p className="type-body-xs mt-2 flex items-center gap-1 pl-12 text-warning row-wide:col-span-5 row-wide:mt-0">
						<AlertTriangle className="h-3 w-3" aria-hidden />A deleted automatic payment won&apos;t be recorded again
					</p>
				) : null}
				{isActive && account && (accountWarning(account) || feeWarning) && (
					<p className="type-body-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-12 row-wide:col-span-5 row-wide:mt-0 row-wide:pl-12">
						<RecurringAccountWarning account={account} fee={feeWarning} />
					</p>
				)}
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
				categoryOptions={categoryOptions}
				accounts={accounts}
			/>
			<DeleteConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title={`Delete ${subscription.name}?`}
				description="Future payments stop. Transactions already recorded are kept."
				onConfirm={handleDelete}
			/>
		</li>
	);
}
