"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/format";

interface CapWarningProps {
	message: string;
	/** The largest amount the account allows; offers a one-tap fix when set. */
	maxAllowed?: number;
	onUseMax: (amount: number) => void;
	/** Shows the overpayment switch (only liabilities can be overpaid). */
	overridable?: boolean;
	allowOverpayment?: boolean;
	onAllowOverpaymentChange?: (allow: boolean) => void;
	id?: string;
}

/** An amount past the account's balance or debt, with the ways to resolve it. */
export function CapWarning({
	message,
	maxAllowed,
	onUseMax,
	overridable = false,
	allowOverpayment = false,
	onAllowOverpaymentChange,
	id = "allow-overpayment",
}: CapWarningProps) {
	return (
		<div role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3">
			<div className="flex items-start gap-2.5">
				<span
					className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-muted text-warning"
					aria-hidden
				>
					<AlertTriangle className="h-3 w-3" />
				</span>
				<p className="type-body-sm text-primary">{message}</p>
			</div>
			{(maxAllowed !== undefined || overridable) && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
					{maxAllowed !== undefined && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							data-dialog-ignore-enter=""
							className="h-11 rounded-full bg-card px-4 sm:h-8"
							onClick={() => onUseMax(maxAllowed)}
						>
							Use {formatMoney(maxAllowed, { showCents: true })}
						</Button>
					)}
					{overridable && (
						<div className="flex items-center gap-2">
							<Switch id={id} checked={allowOverpayment} onCheckedChange={onAllowOverpaymentChange} />
							<Label htmlFor={id} className="type-body-sm cursor-pointer text-muted-foreground">
								Allow overpayment
							</Label>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
