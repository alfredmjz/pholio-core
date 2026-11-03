"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SurfaceSection } from "@/components/layout/surface-section";
import { formatCurrency } from "@/app/dashboard/utils";
import { cn } from "@/lib/utils";
import { formatFrequency, formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { accountWarning, accountWarningText } from "@/lib/account-links";
import { feeWarningUntil, projectAccountFees, projectedFeeText, scheduledPayments } from "@/lib/overdraft";
import type { AccountRecurringItem } from "../../actions";
import type { AccountWithType } from "../../types";

interface RecurringChargesCardProps {
	account: AccountWithType;
	items: AccountRecurringItem[];
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
}

/**
 * Bills, subscriptions and transfers paid from this account, transfers into it, and the fees the
 * outgoing ones would charge. Hidden when there are none.
 */
export function RecurringChargesCard({ account, items, today }: RecurringChargesCardProps) {
	if (items.length === 0) return null;
	const warning = accountWarning(account);
	const outgoing = items.filter((item) => item.direction === "out");
	const incoming = items.length - outgoing.length;
	const fees = projectAccountFees(account, scheduledPayments(outgoing, feeWarningUntil(today)));
	const monthlyNote = [
		outgoing.length > 0 &&
			`${outgoing.length} ${outgoing.length === 1 ? "item is" : "items are"} paid from this account`,
		incoming > 0 && `${incoming} ${incoming === 1 ? "transfer comes" : "transfers come"} in`,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<SurfaceSection
			id="recurring-charges-heading"
			title="Recurring"
			note={monthlyNote}
			action={{ label: "All recurring", href: "/recurring" }}
		>
			{warning && (
				<p className="type-body-xs mb-2 flex items-start gap-1.5 text-warning">
					<AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
					{accountWarningText(warning, "This account")}. Payments still post to it.
				</p>
			)}
			{fees.map((fee) => (
				<p key={`${fee.recurringId}-${fee.date}`} className="type-body-xs mb-2 flex items-start gap-1.5 text-warning">
					<AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
					{projectedFeeText(fee, {
						account: "this account",
						money: (amount) => formatCurrency(amount, { showCents: true }),
						date: (date) => formatShortDate(parseLocalDate(date)),
					})}
				</p>
			))}
			<ul className="-mx-2 flex flex-col">
				{items.map((item) => (
					<li key={item.id}>
						<Link
							href="/recurring"
							className="row-interactive flex items-center justify-between gap-3 rounded-xl px-2 py-2.5"
						>
							<span className="min-w-0">
								<span className="type-body-sm block truncate font-medium text-primary">{item.name}</span>
								<span className="type-body-xs block truncate text-muted-foreground">
									{formatFrequency(item.billing_period)}, next {formatShortDate(parseLocalDate(item.next_due_date))}
								</span>
							</span>
							<span className={cn("type-value shrink-0", item.direction === "in" ? "text-success" : "text-primary")}>
								{item.direction === "in" ? "+" : "-"}
								{formatCurrency(item.amount, { showCents: true })}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</SurfaceSection>
	);
}
