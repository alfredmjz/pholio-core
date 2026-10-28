"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfacePage } from "@/components/layout/surface-page";
import { SurfaceSection } from "@/components/layout/surface-section";
import { ShortcutHint } from "@/components/common/shortcut-hint";
import { useOptimisticRecurring } from "@/hooks/useOptimisticRecurring";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS, ShortcutId } from "@/lib/keyboard-shortcuts";
import { getTodayDateString } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { cn } from "@/lib/utils";
import type { AccountWithType } from "@/app/accounts/types";
import type { RecurringExpense } from "../actions";
import { monthlyEquivalent } from "../recurring-schedule";
import { AddRecurringDialog } from "./add-recurring-dialog";
import { BillRow } from "./bill-row";
import { MonthTimeline } from "./month-timeline";
import { RECURRING_GRID } from "./recurring-row-parts";
import { SubscriptionRow } from "./subscription-row";
import { useFormatSettings } from "@/components/providers/format-provider";

interface RecurringClientProps {
	initialExpenses: RecurringExpense[];
	timezone: string | null;
	categoryOptions?: string[];
	accounts?: AccountWithType[];
}

const byDueDate = (a: RecurringExpense, b: RecurringExpense) => a.next_due_date.localeCompare(b.next_due_date);

function ColumnHeader({ labels }: { labels: [string, string, string, string] }) {
	return (
		<div
			className={cn(
				RECURRING_GRID,
				"type-body-xs hidden border-b border-border/70 px-3 pb-2 text-muted-foreground row-wide:grid"
			)}
			aria-hidden
		>
			<span>{labels[0]}</span>
			<span>{labels[1]}</span>
			<span>{labels[2]}</span>
			<span className="text-right">{labels[3]}</span>
			<span />
		</div>
	);
}

export function RecurringClient({
	initialExpenses,
	timezone,
	categoryOptions = [],
	accounts = [],
}: RecurringClientProps) {
	useFormatSettings();
	const { expenses, optimisticallyAdd, optimisticallyDelete, optimisticallyUpdate } =
		useOptimisticRecurring(initialExpenses);
	const [isAddOpen, setIsAddOpen] = useState(false);

	useKeyboardShortcut(SHORTCUTS[ShortcutId.AddRecurring].keys, () => setIsAddOpen(true));

	const today = getTodayDateString(timezone || undefined);
	const bills = expenses.filter((e) => e.category === "bill").sort(byDueDate);
	// Active subscriptions first, by next payment; paused ones after.
	const subscriptions = expenses
		.filter((e) => e.category === "subscription")
		.sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || byDueDate(a, b));

	const active = expenses.filter((e) => e.is_active !== false);
	const monthlyTotal = active.reduce((sum, e) => sum + monthlyEquivalent(Number(e.amount), e.billing_period), 0);
	const billsMonthly = active
		.filter((e) => e.category === "bill")
		.reduce((sum, e) => sum + monthlyEquivalent(Number(e.amount), e.billing_period), 0);
	const subscriptionsMonthly = monthlyTotal - billsMonthly;
	const activeSubscriptions = subscriptions.filter((s) => s.is_active !== false).length;

	return (
		<SurfacePage>
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="type-h2 text-primary">Recurring</h1>
					<p className="type-body mt-1 text-muted-foreground">
						<span className="text-primary">{formatCurrency(monthlyTotal, { showCents: true })}</span> a month across{" "}
						{active.length} active {active.length === 1 ? "item" : "items"}
					</p>
				</div>
				<Button onClick={() => setIsAddOpen(true)} className="h-10 gap-2 rounded-full pl-3.5 pr-4">
					<Plus className="h-4 w-4" aria-hidden />
					Add recurring
					<ShortcutHint
						keys={SHORTCUTS[ShortcutId.AddRecurring].keys}
						keyClassName="border-current bg-transparent text-current"
					/>
				</Button>
			</header>

			<MonthTimeline expenses={expenses} today={today} />

			<SurfaceSection
				id="bills-heading"
				className="rows-container"
				title="Bills"
				note={
					bills.length > 0
						? `About ${formatCurrency(billsMonthly, { showCents: true })} a month. Pay each one when it's due.`
						: undefined
				}
			>
				{bills.length === 0 ? (
					<p className="type-body-sm py-4 text-muted-foreground">
						No bills yet. Add rent, utilities or a phone plan to see when each one is due.
					</p>
				) : (
					<>
						<ColumnHeader labels={["Bill", "Next due", "This month", "Amount"]} />
						<ul className="mt-1 divide-y divide-border/50" aria-label="Bills">
							{bills.map((bill) => (
								<BillRow
									key={bill.id}
									bill={bill}
									onDelete={optimisticallyDelete}
									onUpdate={optimisticallyUpdate}
									timezone={timezone}
									categoryOptions={categoryOptions}
									accounts={accounts}
								/>
							))}
						</ul>
					</>
				)}
			</SurfaceSection>

			<SurfaceSection
				id="subscriptions-heading"
				className="rows-container"
				title="Subscriptions"
				note={
					subscriptions.length > 0
						? `${activeSubscriptions} active, about ${formatCurrency(subscriptionsMonthly, { showCents: true })} a month. Paid automatically.`
						: undefined
				}
			>
				{subscriptions.length === 0 ? (
					<p className="type-body-sm py-4 text-muted-foreground">
						No subscriptions yet. Add streaming, software or memberships to see what renews and when.
					</p>
				) : (
					<>
						<ColumnHeader labels={["Subscription", "Next payment", "", "Amount"]} />
						<ul className="mt-1 divide-y divide-border/50" aria-label="Subscriptions">
							{subscriptions.map((sub) => (
								<SubscriptionRow
									key={sub.id}
									subscription={sub}
									timezone={timezone}
									onDelete={optimisticallyDelete}
									onUpdate={optimisticallyUpdate}
									categoryOptions={categoryOptions}
									accounts={accounts}
								/>
							))}
						</ul>
					</>
				)}
			</SurfaceSection>

			<AddRecurringDialog
				open={isAddOpen}
				onOpenChange={setIsAddOpen}
				onSuccess={optimisticallyAdd}
				categoryOptions={categoryOptions}
				accounts={accounts}
			/>
		</SurfacePage>
	);
}
