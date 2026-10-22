"use client";

import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { SurfaceSection } from "@/components/layout/surface-section";
import { cn } from "@/lib/utils";
import type { AllocationContributions } from "@/lib/types/contribution";
import { reorderCategories } from "../actions";
import { useAllocationContext } from "../context/AllocationContext";
import type { AllocationCategory } from "../types";
import { VIRTUAL_UNCATEGORIZED_ID } from "../types";
import { getCategoryColor } from "../utils/colors";
import { getCategoryFigures } from "../utils/category-figures";
import { CATEGORY_GRID, CategoryRow } from "./category-row";

interface CategoryListProps {
	categories: AllocationCategory[];
	onAddCategory: () => void;
	usedColors: string[];
	usedNames: string[];
	contributions: AllocationContributions;
	year: number;
	onContributionPlanChanged: () => void;
}

/** Every budget category as a ledger row: drag to reorder, click to edit. */
export function CategoryList({
	categories,
	onAddCategory,
	usedColors,
	usedNames,
	contributions,
	year,
	onContributionPlanChanged,
}: CategoryListProps) {
	const { optimisticallyReorderCategories } = useAllocationContext();

	const isUncategorized = (cat: AllocationCategory) =>
		cat.id === VIRTUAL_UNCATEGORIZED_ID || cat.name.toLowerCase() === "uncategorized";
	const budgeted = categories.filter((cat) => !isUncategorized(cat));
	const uncategorized = categories.find(isUncategorized);
	const uncategorizedRow = uncategorized ? { ...uncategorized, id: VIRTUAL_UNCATEGORIZED_ID } : null;

	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const oldIndex = categories.findIndex((c) => c.id === active.id);
		const newIndex = categories.findIndex((c) => c.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const newOrder = arrayMove(categories, oldIndex, newIndex);
		optimisticallyReorderCategories(newOrder);
		reorderCategories(newOrder.map((cat, index) => ({ id: cat.id, display_order: index }))).then((success) => {
			if (!success) toast.error("Couldn't save the new order", { description: "Try dragging it again." });
		});
	};

	const takenPlansFor = (categoryId: string) =>
		Object.entries(contributions.categoryPlans)
			.filter(([id]) => id !== categoryId)
			.map(([, plan]) => plan);

	const rowProps = (category: AllocationCategory) => ({
		category,
		figures: getCategoryFigures(category, contributions),
		color: getCategoryColor(category.id, category.color, category.display_order),
		usedColors,
		usedNames,
		takenPlans: takenPlansFor(category.id),
		year,
		onContributionPlanChanged,
	});

	return (
		<SurfaceSection
			id="categories-heading"
			title="Categories"
			note={budgeted.length > 1 ? "Drag the handle to reorder. Select a row to edit it." : undefined}
			headerActions={
				<Button variant="outline" size="sm" onClick={onAddCategory} className="h-9 gap-1.5 rounded-full px-3.5">
					<Plus className="h-4 w-4" aria-hidden />
					Add category
				</Button>
			}
		>
			<div
				className={cn(
					CATEGORY_GRID,
					"type-body-xs hidden gap-4 border-b border-border/70 px-3 pb-2 text-muted-foreground md:grid"
				)}
				aria-hidden
			>
				<span className="pl-7">Category</span>
				<span>Progress</span>
				<span className="text-right">Spent</span>
				<span className="text-right">Left</span>
				<span />
			</div>

			<DndContext
				id="allocation-category-list"
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
				modifiers={[restrictToVerticalAxis, restrictToParentElement]}
			>
				{budgeted.length === 0 ? (
					<p className="type-body-sm py-6 text-center text-muted-foreground">
						No categories yet.{" "}
						<button type="button" onClick={onAddCategory} className="text-primary underline-offset-4 hover:underline">
							Add your first category
						</button>{" "}
						to start giving your income a job.
					</p>
				) : (
					<SortableContext items={budgeted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
						<ul className="mt-1 divide-y divide-border/50">
							{budgeted.map((category) => (
								<CategoryRow key={category.id} {...rowProps(category)} />
							))}
						</ul>
					</SortableContext>
				)}

				{/* Uncategorized always comes last and can't be dragged. */}
				{uncategorizedRow && (
					<ul className="mt-1 border-t border-dashed border-border/80">
						<CategoryRow {...rowProps(uncategorizedRow)} sortable={false} />
					</ul>
				)}
			</DndContext>
		</SurfaceSection>
	);
}
