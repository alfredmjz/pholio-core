"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { reorderCategories } from "../actions";
import { toast } from "sonner";
import { useAllocationContext } from "../context/AllocationContext";
import type { AllocationCategory } from "../types";
import { CategoryCard } from "./CategoryCard";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { rectSortingStrategy } from "@dnd-kit/sortable";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { getCategoryColor } from "../utils/colors";

export interface CategoryPerformanceProps {
	categories: AllocationCategory[];
	onAddCategory: () => void;
	className?: string;
	usedColors?: string[];
	usedNames?: string[];
}

export function CategoryPerformance({
	categories,
	onAddCategory,
	className,
	usedColors: propUsedColors,
	usedNames: propUsedNames,
}: CategoryPerformanceProps) {
	const [activeId, setActiveId] = useState<string | null>(null);
	const { optimisticallyReorderCategories } = useAllocationContext();

	const usedColors = propUsedColors || (categories.map((c) => c.color).filter(Boolean) as string[]);
	const usedNames = propUsedNames || categories.map((c) => c.name);

	const sensors = useSensors(
		useSensor(MouseSensor, {
			activationConstraint: {
				distance: 1,
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 200,
				tolerance: 5,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragStart = (event: any) => {
		setActiveId(event.active.id);
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		setActiveId(null);
		const { active, over } = event;

		if (!over || active.id === over.id) {
			return;
		}

		const oldIndex = categories.findIndex((c) => c.id === active.id);
		const newIndex = categories.findIndex((c) => c.id === over.id);

		if (oldIndex !== -1 && newIndex !== -1) {
			const newOrder = arrayMove(categories, oldIndex, newIndex);

			optimisticallyReorderCategories(newOrder);

			const updates = newOrder.map((cat, index) => ({
				id: cat.id,
				display_order: index,
			}));

			reorderCategories(updates).then((success) => {
				if (!success) {
					toast.error("Failed to save order");
				}
			});
		}
	};

	if (categories.length === 0) {
		return (
			<div className={cn("w-full flex flex-col gap-4", className)}>
				<div className="flex items-center justify-between px-2 md:px-0">
					<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Category Performance</h3>
					<Button size="sm" onClick={onAddCategory} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
						<Plus className="h-4 w-4" />
						Add
					</Button>
				</div>
				<Card className="p-12 flex items-center justify-center border-dashed">
					<div className="text-center">
						<p className="text-sm text-muted-foreground mb-4">
							No categories yet. Add your first category to start tracking.
						</p>
						<Button onClick={onAddCategory} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
							<Plus className="h-4 w-4" />
							Add Category
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className={cn("w-full flex flex-col gap-4", className)}>
			{/* Global style injection while dragging to force the cursor to be a grabbing hand everywhere */}
			{activeId && (
				<style>{`
					body * {
						cursor: grabbing !important;
					}
				`}</style>
			)}
			<div className="flex items-center justify-between px-2 md:px-0">
				<h3 className="text-sm font-semibold text-foreground tracking-tight">Category Performance</h3>
				<Button variant="outline" size="sm" onClick={onAddCategory} className="gap-1.5">
					<Plus className="h-4 w-4" />
					Add Category
				</Button>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				modifiers={[restrictToParentElement]}
			>
				<div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
					<SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
						{categories.map((category) => (
							<CategoryCard key={category.id} category={category} usedColors={usedColors} usedNames={usedNames} />
						))}
					</SortableContext>
				</div>
			</DndContext>
		</div>
	);
}

export { getCategoryColor };
