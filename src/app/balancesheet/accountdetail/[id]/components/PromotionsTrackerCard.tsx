"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Trophy, CheckCircle2, Clock, Plus, Edit2, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getAccountPromotions, updateAccountPromotion, deleteAccountPromotion } from "@/lib/actions/promotion-actions";
import type { AccountPromotion } from "@/app/balancesheet/types";
import { PromotionDialog } from "./PromotionDialog";
import { parseLocalDate, differenceInDays } from "@/lib/date-utils";

interface PromotionsTrackerCardProps {
	accountId: string;
	formatCurrency: (amount: number) => string;
}

export function PromotionsTrackerCard({ accountId, formatCurrency }: PromotionsTrackerCardProps) {
	const [promotions, setPromotions] = useState<AccountPromotion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingPromotion, setEditingPromotion] = useState<AccountPromotion | null>(null);

	const loadPromotions = async () => {
		setIsLoading(true);
		try {
			const data = await getAccountPromotions(accountId);
			setPromotions(data);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadPromotions();
	}, [accountId]);

	const handleToggleCompleted = async (promo: AccountPromotion) => {
		const newStatus = !promo.is_completed;
		const success = await updateAccountPromotion(promo.id, { is_completed: newStatus });
		if (success) {
			toast.success(newStatus ? "Promotion marked as completed! 🎉" : "Promotion reopened");
			loadPromotions();
		}
	};

	const handleDelete = async (id: string) => {
		const success = await deleteAccountPromotion(id);
		if (success) {
			toast.success("Promotion deleted");
			loadPromotions();
		}
	};

	const handleAddClick = () => {
		setEditingPromotion(null);
		setDialogOpen(true);
	};

	const handleEditClick = (promo: AccountPromotion) => {
		setEditingPromotion(promo);
		setDialogOpen(true);
	};

	return (
		<Card className="p-5 border-purple-200/50 bg-purple-50/20 dark:bg-purple-950/10 dark:border-purple-900/40">
			<div className="flex flex-col gap-4">
				{/* Card Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
							<Gift className="h-4 w-4" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
								Welcome Bonuses & Promotions
							</h3>
							<p className="text-xs text-muted-foreground">Track minimum spend and deposit reward goals</p>
						</div>
					</div>

					<Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleAddClick}>
						<Plus className="h-3.5 w-3.5" />
						Add Promotion
					</Button>
				</div>

				{/* Promotions List */}
				{promotions.length === 0 ? (
					<div className="p-4 text-center rounded-xl bg-background/60 border border-dashed border-border/60">
						<Sparkles className="h-6 w-6 text-purple-400 mx-auto mb-1.5 opacity-80" />
						<p className="text-xs font-medium text-primary">No active promotions on this account</p>
						<p className="text-[11px] text-muted-foreground mt-0.5">
							Track sign-up bonuses, minimum spend thresholds, and transfer rewards.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{promotions.map((promo) => {
							const today = new Date();
							const endDate = parseLocalDate(promo.end_date);
							const daysRemaining = Math.max(0, differenceInDays(endDate, today));
							const isExpired = daysRemaining === 0 && !promo.is_completed;
							const progressPct = Math.min(100, Math.max(0, (promo.current_amount / promo.target_amount) * 100));
							const remainingAmount = Math.max(0, promo.target_amount - promo.current_amount);
							const dailyPace = daysRemaining > 0 && remainingAmount > 0 ? remainingAmount / daysRemaining : 0;

							return (
								<div
									key={promo.id}
									className="p-4 rounded-xl bg-background/90 border border-border/60 flex flex-col gap-3 relative shadow-xs"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex flex-col gap-1">
											<div className="flex items-center gap-2">
												<span className="font-semibold text-sm text-primary">{promo.title}</span>
												{promo.is_completed ? (
													<Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-300">
														<CheckCircle2 className="h-3 w-3 mr-1" /> Achieved!
													</Badge>
												) : isExpired ? (
													<Badge variant="secondary" className="text-red-600 bg-red-100 dark:bg-red-950/40">
														Expired
													</Badge>
												) : (
													<Badge variant="outline" className="text-purple-600 border-purple-300 dark:text-purple-400">
														<Clock className="h-3 w-3 mr-1" /> {daysRemaining}d left
													</Badge>
												)}
											</div>
											<div className="flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 font-medium">
												<Trophy className="h-3.5 w-3.5 text-amber-500" />
												<span>Reward: {promo.reward_description}</span>
											</div>
										</div>

										<div className="flex items-center gap-1">
											<Button
												size="icon"
												variant="ghost"
												className="h-7 w-7 text-muted-foreground hover:text-foreground"
												onClick={() => handleEditClick(promo)}
											>
												<Edit2 className="h-3.5 w-3.5" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												className="h-7 w-7 text-error/70 hover:text-error"
												onClick={() => handleDelete(promo.id)}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									</div>

									{/* Progress Section */}
									<div className="space-y-1.5">
										<div className="flex items-center justify-between text-xs">
											<span className="text-muted-foreground font-medium">
												{formatCurrency(promo.current_amount)} / {formatCurrency(promo.target_amount)}
											</span>
											<span className="font-bold text-primary">{progressPct.toFixed(1)}%</span>
										</div>
										<Progress value={progressPct} className="h-2.5 bg-muted" />
									</div>

									{/* Footer / Pace info */}
									{!promo.is_completed && daysRemaining > 0 && remainingAmount > 0 && (
										<div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
											<span>Target remaining: {formatCurrency(remainingAmount)}</span>
											<span className="font-medium text-purple-600 dark:text-purple-400">
												Need ~{formatCurrency(dailyPace)}/day
											</span>
										</div>
									)}

									<div className="pt-1 flex justify-end">
										<Button
											size="sm"
											variant={promo.is_completed ? "outline" : "default"}
											className="h-7 text-xs font-medium"
											onClick={() => handleToggleCompleted(promo)}
										>
											{promo.is_completed ? "Reopen Promotion" : "Mark as Completed"}
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			<PromotionDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				accountId={accountId}
				promotion={editingPromotion}
				onSuccess={loadPromotions}
			/>
		</Card>
	);
}
