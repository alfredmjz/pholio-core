"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCategoryBudget, updateCategoryName, deleteCategory, reorderCategories } from "../actions";
import { toast } from "sonner";
import { useAllocationContext } from "../context/AllocationContext";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import type { AllocationCategory } from "../types";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

interface CategoryPerformanceProps {
	categories: AllocationCategory[];
	onAddCategory: () => void;
	className?: string;
}

// Color palette for categories (matching the screenshot)
const CATEGORY_COLORS = [
	{ bg: "bg-cyan-500", text: "text-cyan-500", light: "bg-cyan-100" },
	{ bg: "bg-green-500", text: "text-green-500", light: "bg-green-100" },
	{ bg: "bg-amber-500", text: "text-amber-500", light: "bg-amber-100" },
	{ bg: "bg-pink-500", text: "text-pink-500", light: "bg-pink-100" },
	{ bg: "bg-blue-500", text: "text-blue-500", light: "bg-blue-100" },
	{ bg: "bg-red-500", text: "text-red-500", light: "bg-red-100" },
	{ bg: "bg-purple-500", text: "text-purple-500", light: "bg-purple-100" },
	{ bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-100" },
];

const COLOR_MAP: Record<string, string> = {
	blue: "bg-blue-500",
	green: "bg-green-500",
	orange: "bg-orange-500",
	cyan: "bg-cyan-500",
	purple: "bg-purple-500",
	amber: "bg-amber-500",
	pink: "bg-pink-500",
	red: "bg-red-500",
};

function getCategoryColor(id: string, colorName?: string) {
	// 1. Try to find explicit color by name if provided
	if (colorName) {
		const normalizeName = colorName.toLowerCase();

		// Direct name match in our palette check
		// Mapping for common names to our palette
		if (COLOR_MAP[normalizeName]) {
			// Find the full object
			const match = CATEGORY_COLORS.find((c) => c.bg === COLOR_MAP[normalizeName]);
			if (match) return match;
		}
	}

	// 2. Fallback to hash
	// Simple string hash to get a consistent index
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = id.charCodeAt(i) + ((hash << 5) - hash);
	}
	const index = Math.abs(hash) % CATEGORY_COLORS.length;
	return CATEGORY_COLORS[index];
}

interface CategoryRowProps {
	category: AllocationCategory;
}

function CategoryRow({ category }: CategoryRowProps) {
	const { optimisticallyUpdateBudget, optimisticallyUpdateName, optimisticallyDeleteCategory } = useAllocationContext();

	const [isEditing, setIsEditing] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [budgetValue, setBudgetValue] = useState(category.budget_cap.toString());
	const [nameValue, setNameValue] = useState(category.name);

	// Dnd Sortable hook
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 50 : undefined,
		position: "relative" as const,
	};

	const actualSpend = category.actual_spend || 0;
	const utilization = category.budget_cap > 0 ? (actualSpend / category.budget_cap) * 100 : 0;
	const isOverBudget = utilization > 100;

	// Deterministic color based on ID, unless overridden by category.color
	// Note: We'd need to map hex codes to our tailwind classes if we supported custom hexes.
	// For now, if category.color is a key or index we could use it, but our palette is fixed classes.
	// If category.color matches one of our palette items we could use it.
	// We'll stick to the hash which is stable.
	const color = getCategoryColor(category.id, category.color);

	const formatCurrency = (value: number) => {
		return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
	};

	const handleSave = async () => {
		const newBudget = parseFloat(budgetValue);
		const newName = nameValue.trim();

		let hasError = false;

		if (isNaN(newBudget) || newBudget < 0) {
			toast.error("Please enter a valid budget amount");
			hasError = true;
		}

		if (!newName) {
			toast.error("Category name cannot be empty");
			hasError = true;
		}

		if (hasError) return;

		// Optimistic updates
		optimisticallyUpdateBudget(category.id, newBudget);
		optimisticallyUpdateName(category.id, newName);
		setIsEditing(false);

		// Server updates
		const [budgetSuccess, nameSuccess] = await Promise.all([
			updateCategoryBudget(category.id, newBudget),
			updateCategoryName(category.id, newName),
		]);

		if (budgetSuccess && nameSuccess) {
			toast.success("Category updated");
		} else {
			if (!budgetSuccess) {
				toast.error("Update Failed", {
					description: "Failed to update budget amount. Please try again.",
				});
			}
			if (!nameSuccess) {
				toast.error("Rename Failed", {
					description: "Failed to rename the category. Please try again.",
				});
			}
			// Revert if failed (optional, simplified for now)
		}
	};

	const handleCancel = () => {
		setBudgetValue(category.budget_cap.toString());
		setNameValue(category.name);
		setIsEditing(false);
	};

	const handleConfirmDelete = async () => {
		optimisticallyDeleteCategory(category.id);
		setDeleteDialogOpen(false);

		const success = await deleteCategory(category.id);
		if (success) {
			toast.success("Category deleted");
		} else {
			toast.error("Deletion Failed", {
				description: "Could not delete the category. Please try again.",
			});
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			handleCancel();
		}
	};

	return (
		<>
			<div ref={setNodeRef} style={style} className={cn("group px-6 py-3 bg-card", isDragging && "opacity-50")}>
				<div className="flex items-center gap-2 md:gap-6">
					{/* Drag Handle - Visible on hover or when editing */}
					<div
						{...attributes}
						{...listeners}
						className={cn(
							"absolute -left-12 top-1/2 -translate-y-1/2 p-2 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all z-20 touch-none hover:bg-muted rounded cursor-grab",
							isDragging ? "opacity-100 cursor-grabbing" : "cursor-grab"
						)}
					>
						<GripVertical className="h-4 w-4" />
					</div>

					<div className="flex-1 flex items-center justify-between">
						{/* Group: Color + Name */}
						<div className="flex items-center gap-3">
							{/* Color indicator */}
							<div className={cn("w-2 h-2 rounded-full flex-shrink-0", color.bg)} />

							{/* Category name */}
							<div className="min-w-[120px]">
								{isEditing ? (
									<Input
										value={nameValue}
										onChange={(e) => setNameValue(e.target.value)}
										onKeyDown={handleKeyDown}
										className="h-7 text-sm font-medium w-48"
										maxLength={100}
										autoFocus
									/>
								) : (
									<span className="text-sm font-medium text-primary text-left">{category.name}</span>
								)}
							</div>
						</div>

						{/* Amount display */}
						<div className="text-right flex-shrink-0">
							{isEditing ? (
								<div className="flex items-center gap-1 justify-end">
									<span className={cn("text-sm font-semibold", isOverBudget ? "text-error" : "text-primary")}>
										{formatCurrency(actualSpend)}
									</span>
									<span className="text-sm text-primary">/</span>
									<Input
										type="number"
										inputMode="decimal"
										value={budgetValue}
										onChange={(e) => setBudgetValue(e.target.value)}
										onKeyDown={handleKeyDown}
										className="h-6 w-20 text-sm"
									/>
								</div>
							) : (
								<span className="text-sm">
									<span className={cn("font-semibold", isOverBudget ? "text-error" : "text-primary")}>
										{formatCurrency(actualSpend)}
									</span>
									<span className="text-primary"> / {formatCurrency(category.budget_cap)}</span>
								</span>
							)}
						</div>
					</div>
					{/* Action buttons */}
					<div
						className={cn(
							"flex items-center gap-1 transition-opacity",
							isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
						)}
					>
						{isEditing ? (
							<>
								<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSave}>
									<Check className="h-3 w-3 text-success" />
								</Button>
								<Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleCancel}>
									<X className="h-3 w-3 text-primary" />
								</Button>
							</>
						) : (
							<>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 text-primary hover:text-primary"
									onClick={() => setIsEditing(true)}
								>
									<Pencil className="h-3 w-3" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 text-primary hover:text-primary"
									onClick={() => setDeleteDialogOpen(true)}
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							</>
						)}
					</div>
				</div>

				{/* Progress bar */}
				<div className="mt-2 ml-5">
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className={cn(
								"h-full rounded-full transition-all duration-500",
								utilization > 100 ? "bg-error" : color.bg
							)}
							style={{ width: `${Math.min(utilization, 100)}%` }}
						/>
					</div>
				</div>
			</div>

			<DeleteCategoryDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleConfirmDelete}
				categoryName={category.name}
				transactionCount={category.transaction_count}
			/>
		</>
	);
}

export function CategoryPerformance({ categories, onAddCategory, className }: CategoryPerformanceProps) {
	const { optimisticallyReorderCategories } = useAllocationContext();

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (!over || active.id === over.id) {
			return;
		}

		const oldIndex = categories.findIndex((c) => c.id === active.id);
		const newIndex = categories.findIndex((c) => c.id === over.id);

		if (oldIndex !== -1 && newIndex !== -1) {
			const newOrder = arrayMove(categories, oldIndex, newIndex);

			// Optimistically update
			optimisticallyReorderCategories(newOrder);

			// Persist to server
			const updates = newOrder.map((cat, index) => ({
				id: cat.id,
				display_order: index,
			}));

			// Fire and forget, or handle error
			reorderCategories(updates).then((success) => {
				if (!success) {
					toast.error("Failed to save order");
				}
			});
		}
	};

	if (categories.length === 0) {
		return (
			<Card className={cn("h-full p-6 flex flex-col", className)}>
				<div className="flex items-center justify-between mb-4 flex-shrink-0">
					<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Category Performance</h3>
					<Button size="sm" onClick={onAddCategory} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
						<Plus className="h-4 w-4" />
						Add
					</Button>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<p className="text-sm text-primary mb-4">No categories yet. Add your first category to start tracking.</p>
						<Button onClick={onAddCategory} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
							<Plus className="h-4 w-4" />
							Add Category
						</Button>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card className={cn("h-full py-6 flex flex-col", className)}>
			<div className="flex items-center justify-between px-6 mb-4 flex-shrink-0">
				<h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Category Performance</h3>
				<Button variant="outline" size="sm" onClick={onAddCategory} className="gap-1.5">
					<Plus className="h-4 w-4" />
					Add
				</Button>
			</div>

			<div className="flex-1 divide-y-0">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
					modifiers={[restrictToVerticalAxis]}
				>
					<SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
						{categories.map((category) => (
							<CategoryRow key={category.id} category={category} />
						))}
					</SortableContext>
				</DndContext>
			</div>
		</Card>
	);
}

export { getCategoryColor, CATEGORY_COLORS };
