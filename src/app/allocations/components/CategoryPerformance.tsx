"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, GripVertical, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	updateCategoryBudget,
	updateCategoryName,
	deleteCategory,
	reorderCategories,
	updateCategoryColor,
} from "../actions";
import { toast } from "sonner";
import { useAllocationContext } from "../context/AllocationContext";
import { getCategoryColor, CATEGORY_PALETTE, COLOR_NAME_MAP } from "../utils/colors";
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
	usedColors?: string[];
	usedNames?: string[];
}

interface CategoryRowProps {
	category: AllocationCategory;
	usedColors: string[];
	usedNames: string[];
}

function CategoryRow({ category, usedColors, usedNames }: CategoryRowProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [budgetValue, setBudgetValue] = useState(category.budget_cap.toString());
	const [nameValue, setNameValue] = useState(category.name);
	const [selectedColor, setSelectedColor] = useState<string | null>(category.color || null);

	const [isPressed, setIsPressed] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const isUncategorized = category.id === "00000000-0000-0000-0000-000000000000";
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: category.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 50 : undefined,
		position: "relative" as const,
		cursor: isMobile ? (isDragging || isPressed ? "grabbing" : "grab") : "default",
	};

	const actualSpend = category.actual_spend || 0;
	const utilization = category.budget_cap > 0 ? (actualSpend / category.budget_cap) * 100 : 0;
	const isOverBudget = utilization > 100;

	const color = getCategoryColor(category.id, category.color, category.display_order);

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

		// Uniqueness check for name
		if (
			newName.toLowerCase() !== category.name.toLowerCase() &&
			usedNames.some((n) => n.toLowerCase() === newName.toLowerCase())
		) {
			toast.error("Name unavailable", {
				description: "A category with this name already exists.",
			});
			return;
		}

		// Uniqueness check for editing color
		if (selectedColor && selectedColor !== category.color && usedColors.includes(selectedColor)) {
			toast.error("Color unavailable", {
				description: "This color is already in use by another category.",
			});
			return;
		}

		// All uniqueness checks passed
		const [budgetSuccess, nameSuccess, colorSuccess] = await Promise.all([
			updateCategoryBudget(category.id, newBudget),
			updateCategoryName(category.id, newName),
			selectedColor !== category.color && selectedColor
				? updateCategoryColor(category.id, selectedColor)
				: Promise.resolve(true),
		]);

		if (budgetSuccess && nameSuccess && colorSuccess) {
			toast.success("Category updated");
			setIsEditing(false);
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
			if (!colorSuccess) {
				toast.error("Color Update Failed", {
					description: "Failed to update the category color. Please try again.",
				});
			}
		}
	};

	const handleCancel = () => {
		setBudgetValue(category.budget_cap.toString());
		setNameValue(category.name);
		setSelectedColor(category.color || null);
		setIsEditing(false);
	};

	const handleConfirmDelete = async () => {
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
			<div
				ref={setNodeRef}
				style={style}
				className={cn("group px-6 py-3 bg-card", isDragging && "opacity-50")}
				{...(isMobile ? attributes : {})}
				onPointerDown={() => setIsPressed(true)}
				onPointerUp={() => setIsPressed(false)}
				onPointerLeave={() => setIsPressed(false)}
			>
				{/* Mobile: make the entire content area the drag handle */}
				<div {...(isMobile ? listeners : {})}>
					<div className="flex items-center gap-2 md:gap-6">
						{/* Desktop: show grip handle for all categories */}
						<div
							{...(!isMobile ? { ...attributes, ...listeners } : {})}
							className={cn(
								"hidden md:block absolute -left-12 top-1/2 -translate-y-1/2 p-2 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all z-20 touch-none hover:bg-muted rounded",
								isDragging ? "cursor-grabbing" : "cursor-grab"
							)}
							style={{ cursor: isDragging || isPressed ? "grabbing" : "grab" }}
						>
							<GripVertical className="h-4 w-4" />
						</div>

						<div className="flex-1 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className={cn("w-2 h-2 rounded-full flex-shrink-0", color.bg)} />

								<div className="min-w-[120px]">
									{isEditing ? (
										<div className="flex flex-col gap-2">
											<Input
												value={nameValue}
												onChange={(e) => setNameValue(e.target.value)}
												onKeyDown={handleKeyDown}
												className="h-7 text-sm font-medium w-48"
												maxLength={100}
												autoFocus
											/>
											<div className="flex flex-wrap gap-1.5 py-1">
												{CATEGORY_PALETTE.map((c) => {
													const colorName = Object.keys(COLOR_NAME_MAP).find(
														(key) => COLOR_NAME_MAP[key] === CATEGORY_PALETTE.indexOf(c)
													);
													if (!colorName) return null;

													const isSelected = selectedColor === colorName;
													// A color is "used" if it exists in the usedColors list AND it's not the category's current color
													const isUsed = usedColors.includes(colorName) && colorName !== category.color;

													return (
														<button
															key={colorName}
															type="button"
															onClick={() => setSelectedColor(colorName)}
															disabled={isUsed}
															className={cn(
																"w-5 h-5 rounded-full transition-all border relative",
																c.bg,
																isSelected ? "border-primary scale-110 shadow-sm" : "border-transparent",
																isUsed ? "opacity-30 cursor-not-allowed" : "hover:scale-105"
															)}
															title={isUsed ? `${colorName} (Already in use)` : colorName}
														>
															{isSelected && (
																<div className="w-full h-full flex items-center justify-center">
																	<div className="w-1 h-1 rounded-full bg-white shadow-sm" />
																</div>
															)}
															{isUsed && (
																<div className="absolute inset-0 flex items-center justify-center">
																	<div className="w-[1px] h-[60%] bg-white/50 rotate-45" />
																</div>
															)}
														</button>
													);
												})}
											</div>
											{selectedColor && selectedColor !== category.color && usedColors.includes(selectedColor) && (
												<p className="text-[10px] text-error flex items-center gap-1">
													<AlertCircle className="h-2 w-2" />
													Taken
												</p>
											)}
										</div>
									) : (
										<div className="flex flex-col">
											<span className="text-sm font-medium text-primary text-left">{category.name}</span>
											{isUncategorized && (
												<span className="text-[10px] text-muted-foreground">Transactions without a category</span>
											)}
										</div>
									)}
								</div>
							</div>

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
										{!isUncategorized && <span className="text-primary"> / {formatCurrency(category.budget_cap)}</span>}
									</span>
								)}
							</div>
						</div>

						{isUncategorized ? (
							/* Invisible spacer to align amount with other categories */
							<div className="flex items-center gap-1 w-[52px] flex-shrink-0" />
						) : (
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
						)}
					</div>

					<div className="mt-2 ml-5">
						<div className="h-2 bg-muted rounded-full overflow-hidden">
							<div
								className={cn(
									"h-full rounded-full transition-all duration-500",
									!isUncategorized && utilization > 100 ? "bg-error" : color.bg
								)}
								style={{ width: `${isUncategorized ? 100 : Math.min(utilization, 100)}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{!isUncategorized && (
				<DeleteCategoryDialog
					open={deleteDialogOpen}
					onOpenChange={setDeleteDialogOpen}
					onConfirm={handleConfirmDelete}
					categoryName={category.name}
					transactionCount={category.transaction_count}
				/>
			)}
		</>
	);
}

export function CategoryPerformance({
	categories,
	onAddCategory,
	className,
	usedColors: propUsedColors,
	usedNames: propUsedNames,
}: CategoryPerformanceProps) {
	const { optimisticallyReorderCategories } = useAllocationContext();

	const usedColors = propUsedColors || (categories.map((c) => c.color).filter(Boolean) as string[]);
	const usedNames = propUsedNames || categories.map((c) => c.name);

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
							<CategoryRow key={category.id} category={category} usedColors={usedColors} usedNames={usedNames} />
						))}
					</SortableContext>
				</DndContext>
			</div>
		</Card>
	);
}

export { getCategoryColor };
