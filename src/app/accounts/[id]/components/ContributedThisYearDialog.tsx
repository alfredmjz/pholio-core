"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveContributedThisYear } from "@/lib/actions/contribution-actions";
import { validateContributedOverride } from "@/lib/contributed-override";
import { getContributionPlanLabel } from "@/lib/contribution-plans";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import type { RegisteredPlan } from "../../types";

interface ContributedThisYearDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	plan: RegisteredPlan;
	/** The figure saved for this year, if any. */
	currentAmount: number | null;
	currentAsOf: string | null;
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
	onSaved: () => void;
}

/** Lets the user type what they contributed to a plan this year, across every institution. */
export function ContributedThisYearDialog({
	open,
	onOpenChange,
	plan,
	currentAmount,
	currentAsOf,
	today,
	onSaved,
}: ContributedThisYearDialogProps) {
	const [amount, setAmount] = useState("");
	const [asOf, setAsOf] = useState(today);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;
		setAmount(currentAmount !== null ? String(currentAmount) : "");
		setAsOf(currentAsOf ?? today);
		setError(null);
	}, [open, currentAmount, currentAsOf, today]);

	const planLabel = getContributionPlanLabel(plan);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const checked = validateContributedOverride(amount, asOf, today);
		if (!checked.ok) {
			setError(checked.error);
			return;
		}
		setSaving(true);
		const result = await saveContributedThisYear({ plan, amount, as_of: asOf });
		setSaving(false);
		if (!result.ok) {
			toast.error("Couldn't save", { description: result.error.message });
			return;
		}
		toast.success(checked.amount === null ? "Contributed amount cleared" : "Contributed amount saved");
		onOpenChange(false);
		onSaved();
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Contributed this year"
			description={`Everything you put into your ${planLabel} accounts since 1 January, at every institution. It replaces what Pholio added up to that date.`}
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
				<div className="space-y-2">
					<Label htmlFor="contributed-amount">Amount</Label>
					<Input
						id="contributed-amount"
						inputMode="decimal"
						placeholder="0.00"
						value={amount}
						onChange={(event) => {
							setAmount(sanitizeDecimalInput(event.target.value, 2));
							setError(null);
						}}
						className="h-10"
					/>
					<p className="type-body-xs text-muted-foreground">Leave it blank to go back to Pholio&apos;s total.</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="contributed-as-of">Up to</Label>
					<DatePicker
						id="contributed-as-of"
						value={asOf}
						onChange={(value) => {
							setAsOf(value);
							setError(null);
						}}
						minDate={`${today.slice(0, 4)}-01-01`}
						maxDate={today}
					/>
					<p className="type-body-xs text-muted-foreground">
						Contributions you record after this date are added on top.
					</p>
				</div>
				{error && <p className="type-body-sm text-error">{error}</p>}
				<DialogFooter className="pt-2">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
						<CancelShortcut />
					</Button>
					<Button type="submit" disabled={saving} className="gap-2">
						{saving && <Loader2 className="h-4 w-4 animate-spin" />}
						Save
						<SubmitShortcut />
					</Button>
				</DialogFooter>
			</form>
		</ControlBasedDialog>
	);
}
