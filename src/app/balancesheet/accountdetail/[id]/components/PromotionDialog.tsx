"use client";

import { useState, useEffect } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
	createAccountPromotion,
	updateAccountPromotion,
	refreshAccountPromotions,
} from "@/lib/actions/promotion-actions";
import type { AccountPromotion, PromotionType } from "@/app/balancesheet/types";
import { getTodayDateString } from "@/lib/date-utils";

interface PromotionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	accountId: string;
	promotion?: AccountPromotion | null;
	onSuccess?: () => void;
}

export function PromotionDialog({ open, onOpenChange, accountId, promotion, onSuccess }: PromotionDialogProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [title, setTitle] = useState("");
	const [promotionType, setPromotionType] = useState<PromotionType>("spend_threshold");
	const [targetAmount, setTargetAmount] = useState("");
	const [rewardDescription, setRewardDescription] = useState("");
	const [startDate, setStartDate] = useState(getTodayDateString());
	const [endDate, setEndDate] = useState("");
	const [notes, setNotes] = useState("");

	useEffect(() => {
		if (open) {
			if (promotion) {
				setTitle(promotion.title);
				setPromotionType(promotion.promotion_type);
				setTargetAmount(promotion.target_amount.toString());
				setRewardDescription(promotion.reward_description);
				setStartDate(promotion.start_date.split("T")[0]);
				setEndDate(promotion.end_date.split("T")[0]);
				setNotes(promotion.notes || "");
			} else {
				setTitle("");
				setPromotionType("spend_threshold");
				setTargetAmount("");
				setRewardDescription("");
				setStartDate(getTodayDateString());
				// Default end date: +90 days
				const defaultEnd = new Date();
				defaultEnd.setDate(defaultEnd.getDate() + 90);
				setEndDate(defaultEnd.toISOString().split("T")[0]);
				setNotes("");
			}
		}
	}, [open, promotion]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim() || !targetAmount || !rewardDescription.trim() || !endDate) {
			toast.error("Please fill in all required fields");
			return;
		}

		setIsLoading(true);

		try {
			const numTarget = parseFloat(targetAmount);

			if (promotion) {
				const success = await updateAccountPromotion(promotion.id, {
					title: title.trim(),
					promotion_type: promotionType,
					target_amount: numTarget,
					reward_description: rewardDescription.trim(),
					start_date: startDate,
					end_date: endDate,
					notes: notes || undefined,
				});

				if (success) {
					// Dates, target or type may have changed - recompute in the database.
					await refreshAccountPromotions(accountId);
					toast.success("Promotion updated");
					onOpenChange(false);
					onSuccess?.();
				} else {
					toast.error("Update Failed", { description: "Failed to update promotion." });
				}
			} else {
				const created = await createAccountPromotion({
					account_id: accountId,
					title: title.trim(),
					promotion_type: promotionType,
					target_amount: numTarget,
					reward_description: rewardDescription.trim(),
					start_date: startDate,
					end_date: endDate,
					notes: notes || undefined,
				});

				if (created) {
					toast.success("Promotion created!");
					onOpenChange(false);
					onSuccess?.();
				} else {
					toast.error("Creation Failed", { description: "Failed to create promotion." });
				}
			}
		} catch (error) {
			toast.error("Error", { description: error instanceof Error ? error.message : "Unexpected error" });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title={promotion ? "Edit Promotion / Welcome Bonus" : "Add Welcome Bonus / Promotion"}
			description="Track minimum spend thresholds, sign-up bonuses, and promo deadlines."
		>
			<form onSubmit={handleSubmit} className="space-y-4 py-2">
				<div className="space-y-2">
					<Label htmlFor="promo-title">
						Promotion Title <span className="text-error">*</span>
					</Label>
					<Input
						id="promo-title"
						placeholder="e.g. Spend $4,000 in 90 Days for 60k Points"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						required
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="promo-type">Promotion Type</Label>
						<Select value={promotionType} onValueChange={(val: any) => setPromotionType(val)}>
							<SelectTrigger id="promo-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="maintaining_balance">🔒 Balance Holding</SelectItem>
								<SelectItem value="deposit_threshold">🏦 Deposit / Transfer</SelectItem>
								<SelectItem value="spend_threshold">💳 Spend Threshold</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="promo-target">
							Target Threshold ($) <span className="text-error">*</span>
						</Label>
						<Input
							id="promo-target"
							type="number"
							step="0.01"
							placeholder="e.g. 4000.00"
							value={targetAmount}
							onChange={(e) => setTargetAmount(e.target.value)}
							required
						/>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="promo-reward">
						Reward Description <span className="text-error">*</span>
					</Label>
					<Input
						id="promo-reward"
						placeholder="e.g. 60,000 Points or $500 Statement Credit"
						value={rewardDescription}
						onChange={(e) => setRewardDescription(e.target.value)}
						required
					/>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="promo-start">Start Date</Label>
						<DatePicker id="promo-start" value={startDate} onChange={setStartDate} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="promo-end">
							Expiry Date <span className="text-error">*</span>
						</Label>
						<DatePicker id="promo-end" value={endDate} onChange={setEndDate} />
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="promo-notes">Notes (Optional)</Label>
					<Textarea
						id="promo-notes"
						placeholder="Fine print, qualifying transaction exceptions, etc."
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						rows={2}
					/>
				</div>

				<DialogFooter className="pt-4">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button type="submit" disabled={isLoading} className="gap-2">
						{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
						{promotion ? "Save Changes" : "Create Promotion"}
					</Button>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
