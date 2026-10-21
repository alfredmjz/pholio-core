"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { getContributionPlanLabel } from "@/lib/contribution-plans";
import type { RegisteredPlan } from "@/app/balancesheet/types";
import type { AllocationCategory } from "../types";
import type { CategoryColor } from "../utils/colors";
import type { CategoryFigures } from "../utils/category-figures";
import { ContributionRoomMeter } from "./ContributionRoomMeter";
import { CategoryEditDialog } from "./category-edit-dialog";

/** Columns shared by the header row and every category row (desktop). */
export const CATEGORY_GRID = "md:grid md:grid-cols-[minmax(11rem,1.3fr)_minmax(8rem,2fr)_8.5rem_6.5rem_2.25rem]";

interface CategoryRowProps {
	category: AllocationCategory;
	figures: CategoryFigures;
	color: CategoryColor;
	usedColors: string[];
	usedNames: string[];
	takenPlans: RegisteredPlan[];
	year: number;
	onContributionPlanChanged?: () => void;
	/** Uncategorized can't be reordered or edited. */
	sortable?: boolean;
}

const wholeDollars = (value: number) => formatCurrency(value);

export function CategoryRow({
	category,
	figures,
	color,
	usedColors,
	usedNames,
	takenPlans,
	year,
	onContributionPlanChanged,
	sortable = true,
}: CategoryRowProps) {
	const [editOpen, setEditOpen] = useState(false);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: category.id,
		disabled: !sortable,
	});

	const { budget, spent, isUncategorized, plan, pool } = figures;
	const isLinked = !!plan;
	const utilization = budget > 0 ? (spent / budget) * 100 : 0;
	const over = budget > 0 && spent > budget;
	const remaining = Math.abs(budget - spent);
	const editable = !isUncategorized;

	const caption = isUncategorized
		? "Spending with no category"
		: isLinked
			? "Contributed this month"
			: budget > 0
				? `${Math.round(utilization)}% used`
				: "No budget set";

	const status = isUncategorized ? (
		<span className="text-muted-foreground">Unbudgeted</span>
	) : budget <= 0 ? (
		<span className="text-muted-foreground">—</span>
	) : over ? (
		<span className="text-error">{wholeDollars(remaining)} over</span>
	) : (
		<span className={isLinked ? "text-muted-foreground" : "text-success"}>
			{wholeDollars(remaining)} {isLinked ? "to go" : "left"}
		</span>
	);

	const bar = isLinked ? (
		<ContributionRoomMeter
			plan={plan}
			pool={pool}
			budget={budget}
			color={color}
			year={year}
			formatCurrency={wholeDollars}
			compact
		/>
	) : (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/[0.07]" aria-hidden>
			<div
				className={cn(
					"h-full rounded-full transition-[width] duration-500",
					isUncategorized ? "bg-primary/25" : over ? "bg-error" : color.bg
				)}
				style={{ width: `${isUncategorized ? (spent > 0 ? 100 : 0) : Math.min(utilization, 100)}%` }}
			/>
		</div>
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
				className={cn(
					CATEGORY_GRID,
					"items-center gap-4 px-2 py-3 md:px-3",
					editable && "row-interactive cursor-pointer rounded-xl"
				)}
				onClick={() => editable && setEditOpen(true)}
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
						<p className="type-body-xs text-muted-foreground">{caption}</p>
					</div>
					{/* Phone: amounts beside the name */}
					<p className="type-value shrink-0 text-right md:hidden">
						<span className={over ? "text-error" : "text-primary"}>{wholeDollars(spent)}</span>
						{budget > 0 && <span className="text-muted-foreground"> / {wholeDollars(budget)}</span>}
					</p>
				</div>

				{/* Progress */}
				<div className="mt-2.5 pl-7 md:mt-0 md:pl-0">{bar}</div>

				{/* Spent of budget (desktop) */}
				<p className="type-value hidden text-right md:block">
					<span className={over ? "text-error" : "text-primary"}>{wholeDollars(spent)}</span>
					{budget > 0 && <span className="text-muted-foreground"> of {wholeDollars(budget)}</span>}
				</p>

				{/* Left / over, with the phone's edit button beside it */}
				<div className="mt-1 flex min-h-8 items-center justify-between pl-7 md:mt-0 md:block md:min-h-0 md:pl-0 md:text-right">
					<p className="type-body-xs md:type-value">{status}</p>
					{editable && (
						<div className="md:hidden">
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									setEditOpen(true);
								}}
								className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-hover hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"
								aria-label={`Edit ${category.name}`}
							>
								<Pencil className="h-3.5 w-3.5" />
							</button>
						</div>
					)}
				</div>

				{/* Edit (desktop) */}
				<div className="hidden justify-end md:flex">
					{editable && (
						<button
							type="button"
							onClick={(event) => {
								event.stopPropagation();
								setEditOpen(true);
							}}
							className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-hover hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"
							aria-label={`Edit ${category.name}`}
						>
							<Pencil className="h-3.5 w-3.5" />
						</button>
					)}
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
