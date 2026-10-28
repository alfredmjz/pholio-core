"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SurfaceSection } from "@/components/layout/surface-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { cn } from "@/lib/utils";
import { ProgressLine } from "@/components/ui/progress-line";
import { getAccountPromotions, updateAccountPromotion, deleteAccountPromotion } from "@/lib/actions/promotion-actions";
import type { AccountPromotion } from "@/app/accounts/types";
import { parseLocalDate, differenceInDays, formatShortDate } from "@/lib/date-utils";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { PromotionDialog } from "./PromotionDialog";

const EMPTY_PROMOTIONS: AccountPromotion[] = [];

interface PromotionsTrackerCardProps {
	accountId: string;
	formatCurrency: (amount: number) => string;
}

function PromotionStatus({ promo, daysRemaining }: { promo: AccountPromotion; daysRemaining: number }) {
	if (promo.is_completed) {
		return (
			<span className="type-body-xs inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-success">
				<CheckCircle2 className="h-3 w-3" aria-hidden />
				Earned
			</span>
		);
	}
	if (daysRemaining === 0) {
		return <span className="type-body-xs rounded-full bg-error-muted px-2 py-0.5 text-error">Ended</span>;
	}
	return (
		<span
			className={cn(
				"type-body-xs rounded-full px-2 py-0.5",
				daysRemaining <= 14 ? "bg-warning-muted text-warning" : "bg-card-muted text-muted-foreground"
			)}
		>
			{daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
		</span>
	);
}

/** Sign-up bonuses and spend or deposit targets on this account, with how far along each one is. */
export function PromotionsTrackerCard({ accountId, formatCurrency }: PromotionsTrackerCardProps) {
	const {
		data: promotions,
		refresh,
		isLoading,
	} = useServerSyncedData<AccountPromotion[]>(EMPTY_PROMOTIONS, () => getAccountPromotions(accountId), {
		fetchOnMount: true,
	});
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingPromotion, setEditingPromotion] = useState<AccountPromotion | null>(null);
	const [deleting, setDeleting] = useState<AccountPromotion | null>(null);

	const handleToggleCompleted = async (promo: AccountPromotion) => {
		const newStatus = !promo.is_completed;
		const success = await updateAccountPromotion(promo.id, { is_completed: newStatus });
		if (success) {
			toast.success(newStatus ? "Marked as earned" : "Promotion reopened");
			void refresh();
		}
	};

	const handleDelete = async () => {
		if (!deleting) return;
		const success = await deleteAccountPromotion(deleting.id);
		if (success) {
			toast.success("Promotion deleted");
			void refresh();
		} else {
			toast.error("Couldn't delete the promotion", { description: "Try again in a moment." });
		}
	};

	const openDialog = (promo: AccountPromotion | null) => {
		setEditingPromotion(promo);
		setDialogOpen(true);
	};

	return (
		<SurfaceSection
			id="promotions-heading"
			title="Promotions"
			note="Sign-up bonuses and spend or deposit targets"
			headerActions={
				<Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full px-3" onClick={() => openDialog(null)}>
					<Plus className="h-3.5 w-3.5" aria-hidden />
					Add promotion
				</Button>
			}
		>
			{promotions.length === 0 ? (
				isLoading ? (
					<Skeleton className="h-24 w-full rounded-xl" />
				) : (
					<p className="type-body-sm text-muted-foreground">
						No promotions on this account. Add one to track a bonus deadline and how much is left to spend or deposit.
					</p>
				)
			) : (
				<ul className="flex flex-col divide-y divide-border/50">
					{promotions.map((promo) => {
						const endDate = parseLocalDate(promo.end_date);
						const daysRemaining = Math.max(0, differenceInDays(endDate, new Date()));
						const progressPct = Math.min(100, Math.max(0, (promo.current_amount / promo.target_amount) * 100));
						const remainingAmount = Math.max(0, promo.target_amount - promo.current_amount);
						const dailyPace = daysRemaining > 0 && remainingAmount > 0 ? remainingAmount / daysRemaining : 0;

						return (
							<li key={promo.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<span className="type-body-sm font-medium text-primary">{promo.title}</span>
											<PromotionStatus promo={promo} daysRemaining={daysRemaining} />
										</div>
										<p className="type-body-xs mt-0.5 text-muted-foreground">
											{promo.reward_description}, ends {formatShortDate(promo.end_date)}
										</p>
									</div>
									<div className="flex shrink-0 items-center">
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
											onClick={() => openDialog(promo)}
											aria-label={`Edit ${promo.title}`}
										>
											<Pencil className="h-3.5 w-3.5" />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 rounded-full text-muted-foreground hover:text-error"
											onClick={() => setDeleting(promo)}
											aria-label={`Delete ${promo.title}`}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>

								<div>
									<ProgressLine
										value={progressPct}
										tone={promo.is_completed ? "bg-success" : "bg-accent"}
										label={`${promo.title} progress`}
									/>
									<div className="type-body-xs mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-muted-foreground">
										<span>
											{formatCurrency(promo.current_amount)} of {formatCurrency(promo.target_amount)}
										</span>
										{!promo.is_completed && dailyPace > 0 && (
											<span>
												{formatCurrency(remainingAmount)} to go, about {formatCurrency(dailyPace)} a day
											</span>
										)}
									</div>
								</div>

								<div className="flex justify-end">
									<Button
										size="sm"
										variant={promo.is_completed ? "ghost" : "outline"}
										className="h-8 rounded-full px-3"
										onClick={() => handleToggleCompleted(promo)}
									>
										{promo.is_completed ? "Reopen" : "Mark as earned"}
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<PromotionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				accountId={accountId}
				promotion={editingPromotion}
				onSuccess={refresh}
			/>
			<DeleteConfirmDialog
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title="Delete promotion"
				description={deleting ? `Delete "${deleting.title}"? Its progress will be lost.` : ""}
				onConfirm={handleDelete}
			/>
		</SurfaceSection>
	);
}
