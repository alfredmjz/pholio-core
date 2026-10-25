"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { getDaysInMonth, parseLocalDate } from "@/lib/date-utils";
import type { RecurringExpense } from "../actions";
import { occurrencesInMonth, type OccurrenceState } from "../recurring-schedule";
import { formatDateParts } from "@/lib/format";

interface TimelineItem {
	id: string;
	name: string;
	amount: number;
	kind: "bill" | "subscription";
	state: OccurrenceState;
}

const STATE_LABEL: Record<OccurrenceState, string> = {
	paid: "Paid",
	overdue: "Overdue",
	due_today: "Due today",
	upcoming: "Upcoming",
};

const MARKER_TONE: Record<OccurrenceState, string> = {
	paid: "bg-primary/30 border-transparent",
	overdue: "bg-error border-transparent",
	due_today: "bg-accent border-transparent",
	upcoming: "bg-transparent border-primary/70",
};

const MAX_STACK = 3;

function Marker({
	kind,
	state,
	className,
}: {
	kind: TimelineItem["kind"];
	state: OccurrenceState;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"block h-2.5 w-2.5 border-[1.5px]",
				kind === "bill" ? "rounded-[3px]" : "rounded-full",
				MARKER_TONE[state],
				className
			)}
			aria-hidden
		/>
	);
}

interface MonthTimelineProps {
	expenses: RecurringExpense[];
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
}

/** This month's days, with every active bill and subscription placed on its due date. */
export function MonthTimeline({ expenses, today }: MonthTimelineProps) {
	const now = parseLocalDate(today);
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const daysInMonth = getDaysInMonth(year, month);
	const todayDay = now.getDate();
	const monthName = formatDateParts(now, { month: "long" });

	const byDay = useMemo(() => {
		const days = new Map<number, TimelineItem[]>();
		for (const expense of expenses) {
			if (expense.is_active === false) continue;
			const kind = expense.category === "bill" ? "bill" : "subscription";
			for (const occurrence of occurrencesInMonth(expense.next_due_date, expense.billing_period, year, month, today)) {
				const day = Number(occurrence.date.slice(8, 10));
				const list = days.get(day) ?? [];
				list.push({
					id: expense.id,
					name: expense.name,
					amount: Number(expense.amount),
					kind,
					state: occurrence.state,
				});
				days.set(day, list);
			}
		}
		return days;
	}, [expenses, year, month, today]);

	const totals = useMemo(() => {
		let paid = 0;
		let due = 0;
		byDay.forEach((items) =>
			items.forEach((item) => {
				if (item.state === "paid") paid += item.amount;
				else due += item.amount;
			})
		);
		return { paid, due };
	}, [byDay]);

	// Start on the next day with something still to pay, or today.
	const firstOpenDay =
		Array.from(byDay.entries())
			.filter(([day, items]) => day >= todayDay && items.some((item) => item.state !== "paid"))
			.map(([day]) => day)
			.sort((a, b) => a - b)[0] ?? todayDay;
	const [selected, setSelected] = useState<number>(firstOpenDay);
	const selectedItems = byDay.get(selected) ?? [];
	const labelDays = new Set([1, 5, 10, 15, 20, 25, daysInMonth, todayDay]);

	return (
		<section aria-labelledby="timeline-heading" className="surface-sheet surface-sheet-pad">
			<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<div>
					<h2 id="timeline-heading" className="type-h4 text-primary">
						{monthName}
					</h2>
					<p className="type-body-sm mt-0.5 text-muted-foreground">
						{formatCurrency(totals.due, { showCents: true })} still to pay,{" "}
						{formatCurrency(totals.paid, { showCents: true })} paid
					</p>
				</div>
				<ul className="type-body-xs flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
					<li className="flex items-center gap-1.5">
						<Marker kind="bill" state="upcoming" /> Bill
					</li>
					<li className="flex items-center gap-1.5">
						<Marker kind="subscription" state="upcoming" /> Subscription
					</li>
					<li className="flex items-center gap-1.5">
						<Marker kind="subscription" state="paid" /> Paid
					</li>
					<li className="flex items-center gap-1.5">
						<Marker kind="subscription" state="overdue" /> Overdue
					</li>
				</ul>
			</div>

			<div className="mt-6 overflow-x-auto pb-1">
				<div
					className="grid min-w-[300px] items-end"
					style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}
					role="group"
					aria-label={`${monthName} due dates`}
				>
					{Array.from({ length: daysInMonth }, (_, i) => {
						const day = i + 1;
						const items = byDay.get(day) ?? [];
						const isToday = day === todayDay;
						const isSelected = day === selected;
						const shown = items.slice(0, MAX_STACK);
						const extra = items.length - shown.length;
						const column = (
							<>
								<span className="flex min-h-[46px] flex-col-reverse items-center justify-start gap-1 pb-1.5">
									{shown.map((item, index) => (
										<Marker key={`${item.id}-${index}`} kind={item.kind} state={item.state} />
									))}
									{extra > 0 && <span className="type-caption leading-none text-muted-foreground">+{extra}</span>}
								</span>
								<span
									className={cn(
										"block h-px w-full",
										isToday ? "bg-accent" : day <= todayDay ? "bg-primary/25" : "bg-border"
									)}
									aria-hidden
								/>
								<span
									className={cn(
										"type-caption mt-1.5 block h-4 text-center tabular-nums",
										isToday ? "font-semibold text-accent" : "text-muted-foreground",
										!labelDays.has(day) && "invisible"
									)}
								>
									{day}
								</span>
							</>
						);
						return items.length > 0 ? (
							<button
								key={day}
								type="button"
								onClick={() => setSelected(day)}
								aria-pressed={isSelected}
								aria-label={`${monthName} ${day}: ${items.map((item) => `${item.name} ${STATE_LABEL[item.state].toLowerCase()}`).join(", ")}`}
								className={cn(
									"relative flex flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isSelected ? "bg-primary/[0.06]" : "hover:bg-primary/[0.03]"
								)}
							>
								{column}
							</button>
						) : (
							<div key={day} className="relative flex flex-col" aria-hidden>
								{column}
							</div>
						);
					})}
				</div>
			</div>

			<div className="mt-4 border-t border-border/70 pt-4" aria-live="polite">
				<p className="type-label text-muted-foreground">
					{monthName} {selected}
					{selected === todayDay ? ", today" : ""}
				</p>
				{selectedItems.length === 0 ? (
					<p className="type-body-sm mt-1.5 text-muted-foreground">Nothing due on this day.</p>
				) : (
					<ul className="mt-1.5 space-y-1.5">
						{selectedItems.map((item, index) => (
							<li key={`${item.id}-${index}`} className="type-body-sm flex items-center justify-between gap-3">
								<span className="flex min-w-0 items-center gap-2">
									<Marker kind={item.kind} state={item.state} className="shrink-0" />
									<span className="truncate text-primary">{item.name}</span>
									<span className={cn("shrink-0", item.state === "overdue" ? "text-error" : "text-muted-foreground")}>
										{STATE_LABEL[item.state]}
									</span>
								</span>
								<span className="type-value shrink-0 text-primary">
									{formatCurrency(item.amount, { showCents: true })}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
