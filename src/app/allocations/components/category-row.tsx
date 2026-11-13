"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { getContributionPlanLabel } from "@/lib/contribution-plans";
import type { RegisteredPlan } from "@/app/accounts/types";
import type { AllocationCategory } from "../types";
import type { CategoryColor } from "../utils/colors";
import type { CategoryFigures } from "../utils/category-figures";
import { describeBudgetLeft, describePace, getBudgetPace, type MonthDays, type PaceTone } from "../utils/month-pace";
import { ContributionRoomMeter } from "./ContributionRoomMeter";
import { CategoryEditDialog } from "./category-edit-dialog";
import { DayBudgetBar } from "./day-budget-bar";

/** Columns shared by the header row and every category row (desktop). */
export const CATEGORY_GRID = "md:grid md:grid-cols-[minmax(11rem,1.3fr)_minmax(12rem,2.6fr)_8.5rem_2.25rem]";

interface CategoryRowProps {
	category: AllocationCategory;
	figures: CategoryFigures;
	color: CategoryColor;
	usedColors: string[];
	usedNames: string[];
	takenPlans: RegisteredPlan[];
	year: number;
	monthDays: MonthDays;
	monthName: string;
	onContributionPlanChanged?: () => void;
	/** Uncategorized can't be reordered or edited. */
	sortable?: boolean;
	/** Bumped each time this row is dropped, to wiggle its bar in place; 0 means never dropped. */
	dropCount?: number;
}

const wholeDollars = (value: number) => formatCurrency(value);
const perDayAmount = (value: number) => formatCurrency(value, { showCents: value < 10 });

const TONE: Record<PaceTone, string> = {
	success: "text-success",
	error: "text-error",
	muted: "text-muted-foreground",
};

export function CategoryRow({
	category,
	figures,
	color,
	usedColors,
	usedNames,
	takenPlans,
	year,
	monthDays,
	monthName,
	onContributionPlanChanged,
	sortable = true,
	dropCount = 0,
}: CategoryRowProps) {
	const [editOpen, setEditOpen] = useState(false);
	const [wiggling, setWiggling] = useState(false);
	useEffect(() => {
		if (dropCount > 0) setWiggling(true);
	}, [dropCount]);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: category.id,
		disabled: !sortable,
	});

	const { budget, spent, isUncategorized, plan, pool } = figures;
	const isLinked = !!plan;
	const hasBudget = !isUncategorized && budget > 0;
	const pace = getBudgetPace(
		monthDays,
		hasBudget ? budget : 0,
		spent,
		isLinked ? 0 : (category.recurring_budget_cap ?? 0)
	);
	const editable = !isUncategorized;

	const caption = isUncategorized
		? "Spending with no category"
		: isLinked
			? "Contributed this month"
			: describePace(pace, wholeDollars, monthName);
	const captionTone =
		hasBudget && !isLinked && pace.over
			? "text-error"
			: pace.aheadBy > 0 && !isLinked
				? "text-warning"
				: "text-muted-foreground";

	const left = isUncategorized
		? { text: "Unbudgeted", tone: "muted" as const }
		: hasBudget
			? describeBudgetLeft(pace, wholeDollars, isLinked)
			: null;
	const perDay = hasBudget && !isLinked && pace.perDay !== null ? `${perDayAmount(pace.perDay)} a day` : null;

	const spentLabel = hasBudget
		? `${isLinked ? "Contributed" : "Spent"} ${wholeDollars(spent)} of ${wholeDollars(budget)}.`
		: `Spent ${wholeDollars(spent)}, no budget.`;

	const dayBar = (
		<div className="flex flex-col gap-1.5">
			<div className={cn(wiggling && "progress-wiggle")} onAnimationEnd={() => setWiggling(false)}>
				<DayBudgetBar
					pace={pace}
					tone={pace.over ? "bg-error" : color.bg}
					label={left ? `${spentLabel} ${left.text}.` : spentLabel}
				/>
			</div>
			{(left || perDay) && (
				<p className="type-body-xs flex items-baseline justify-between gap-3 tabular-nums" aria-hidden>
					<span className={left ? TONE[left.tone] : undefined}>{left?.text}</span>
					{perDay && <span className="shrink-0 text-muted-foreground">{perDay}</span>}
				</p>
			)}
		</div>
	);

	const editButton = (className: string) => (
		<button
			type="button"
			onClick={(event) => {
				event.stopPropagation();
				setEditOpen(true);
			}}
			className={cn(
				"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-hover hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className
			)}
			aria-label={`Edit ${category.name}`}
		>
			<Pencil className="h-3.5 w-3.5" />
		</button>
	);

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"group relative rounded-xl",
				isDragging && "z-10 bg-card shadow-raised ring-1 ring-border",
				isUncategorized && "opacity-90"
			)}
		>
			<div
				className={cn(CATEGORY_GRID, "items-center gap-4 px-2 py-3 md:px-3", editable && "row-interactive rounded-xl")}
			>
				{/* Name, with the drag handle at its start */}
				<div className="flex min-w-0 items-start gap-2">
					<button
						type="button"
						ref={setActivatorNodeRef}
						{...attributes}
						{...listeners}
						disabled={!sortable}
						onClick={(event) => event.stopPropagation()}
						className={cn(
							"-ml-1 flex h-6 w-5 shrink-0 touch-none items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							sortable
								? "cursor-grab opacity-50 hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing md:opacity-0 md:group-hover:opacity-60"
								: "invisible"
						)}
						aria-label={`Reorder ${category.name}`}
					>
						<GripVertical className="h-4 w-4" />
					</button>
					<span
						className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", isUncategorized ? "bg-primary/25" : color.bg)}
						aria-hidden
					/>
					<div className="min-w-0 flex-1">
						<p className="flex min-w-0 items-center gap-1.5">
							<span className="type-body-sm truncate font-medium text-primary">{category.name}</span>
							{isLinked && (
								<span
									className="type-caption inline-flex shrink-0 items-center gap-0.5 rounded-full bg-success-muted px-1.5 py-0.5 leading-none text-success"
									title={`Counts toward your ${getContributionPlanLabel(plan)} room`}
								>
									<ShieldCheck className="h-2.5 w-2.5" aria-hidden />
									{getContributionPlanLabel(plan)}
								</span>
							)}
						</p>
						<p className={cn("type-body-xs", captionTone)}>{caption}</p>
					</div>
					{/* Phone: amounts and the edit button beside the name */}
					<p className="type-value shrink-0 text-right md:hidden">
						<span className={pace.over ? "text-error" : "text-primary"}>{wholeDollars(spent)}</span>
						{budget > 0 && <span className="text-muted-foreground"> / {wholeDollars(budget)}</span>}
					</p>
					{editable && editButton("-my-1 -mr-1 md:hidden")}
				</div>

				{/* This month, day by day */}
				<div className="mt-2.5 pl-7 md:mt-0 md:pl-0">
					{isLinked ? (
						<ContributionRoomMeter
							plan={plan}
							pool={pool}
							budget={budget}
							color={color}
							year={year}
							formatCurrency={wholeDollars}
							budgetSlot={dayBar}
							compact
						/>
					) : (
						dayBar
					)}
				</div>

				{/* Spent of budget (desktop) */}
				<p className="type-value hidden text-right md:block">
					<span className={pace.over ? "text-error" : "text-primary"}>{wholeDollars(spent)}</span>
					{budget > 0 && <span className="text-muted-foreground"> of {wholeDollars(budget)}</span>}
				</p>

				{/* Edit (desktop) */}
				<div className="hidden justify-end md:flex">
					{editable && editButton("md:opacity-0 md:group-hover:opacity-100")}
				</div>
			</div>

			{editable && (
				<CategoryEditDialog
					open={editOpen}
					onOpenChange={setEditOpen}
					category={category}
					usedColors={usedColors}
					usedNames={usedNames}
					contributionPlan={plan}
					takenPlans={takenPlans}
					onContributionPlanChanged={onContributionPlanChanged}
				/>
			)}
		</li>
	);
}
