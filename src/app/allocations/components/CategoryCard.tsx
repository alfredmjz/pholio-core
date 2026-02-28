"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateCategoryBudget, updateCategoryName, deleteCategory, updateCategoryColor } from "../actions";
import { toast } from "sonner";
import { getCategoryColor, CATEGORY_PALETTE, COLOR_NAME_MAP } from "../utils/colors";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import type { AllocationCategory } from "../types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface CategoryCardProps {
	category: AllocationCategory;
	usedColors: string[];
	usedNames: string[];
}

export function CategoryCard({ category, usedColors, usedNames }: CategoryCardProps) {
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
	const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
		id: category.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		zIndex: isDragging ? 50 : undefined,
		position: "relative" as const,
	};

	const actualSpend = category.actual_spend || 0;
	const utilization = category.budget_cap > 0 ? (actualSpend / category.budget_cap) * 100 : 0;
	const isOverBudget = utilization > 100;
	const amountRemainingOrOver = Math.abs(category.budget_cap - actualSpend);

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

		if (
			newName.toLowerCase() !== category.name.toLowerCase() &&
			usedNames.some((n) => n.toLowerCase() === newName.toLowerCase())
		) {
			toast.error("Name unavailable", {
				description: "A category with this name already exists.",
			});
			return;
		}

		if (selectedColor && selectedColor !== category.color && usedColors.includes(selectedColor)) {
			toast.error("Color unavailable", {
				description: "This color is already in use by another category.",
			});
			return;
		}

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
			<Card
				ref={setNodeRef}
				style={style}
				{...attributes}
				{...(isEditing ? {} : listeners)}
				className={cn(
					"group relative hover:shadow-md hover:border-primary border-border bg-card overflow-hidden w-full outline-none",
					isDragging && "opacity-50 ring-2 ring-primary",
					!isDragging && !isEditing && "cursor-grab active:cursor-grabbing",
					// Mobile vs Desktop Layout
					"flex flex-col md:justify-between", // base flex layout
					// Row style on mobile
					"p-3 md:p-0 rounded-lg md:rounded-xl md:ring-1 md:ring-border/50 md:hover:ring-primary h-auto border md:border-border/60"
				)}
				onPointerDown={() => setIsPressed(true)}
				onPointerUp={() => setIsPressed(false)}
				onPointerLeave={() => setIsPressed(false)}
			>
				{/* ---------------- MOBILE ROW LAYOUT (< 768px) ---------------- */}
				<div className="md:hidden relative z-10 flex items-center justify-between gap-3 w-full">
					{/* Left side: color indicator, content, progress */}
					<div className="flex items-start gap-3 flex-1 min-w-0 pt-0.5">
						<div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", color.bg)} />

						<div className="flex flex-col flex-1 min-w-0">
							{isEditing ? (
								<div className="flex flex-col gap-1 w-full">
									<Input
										value={nameValue}
										onChange={(e) => setNameValue(e.target.value)}
										onKeyDown={handleKeyDown}
										className="h-6 text-sm font-medium w-full px-2"
										maxLength={100}
										autoFocus
									/>
									<div className="flex flex-col gap-1 mt-1">
										<div className="flex items-center gap-1">
											<span className="text-xs font-semibold">{formatCurrency(actualSpend)}</span>
											<span className="text-xs text-muted-foreground">/</span>
											<Input
												type="number"
												inputMode="decimal"
												value={budgetValue}
												onChange={(e) => setBudgetValue(e.target.value)}
												onKeyDown={handleKeyDown}
												className="h-6 w-16 text-xs text-right px-1"
											/>
										</div>
										<div className="flex flex-wrap gap-1 py-0.5">
											{CATEGORY_PALETTE.map((c) => {
												const colorName = Object.keys(COLOR_NAME_MAP).find(
													(key) => COLOR_NAME_MAP[key] === CATEGORY_PALETTE.indexOf(c)
												);
												if (!colorName) return null;
												const isSelected = selectedColor === colorName;
												const isUsed = usedColors.includes(colorName) && colorName !== category.color;

												return (
													<button
														key={colorName}
														type="button"
														onClick={() => setSelectedColor(colorName)}
														disabled={isUsed}
														className={cn(
															"w-4 h-4 rounded-full border relative",
															c.bg,
															isSelected ? "border-primary scale-110 shadow-sm" : "border-transparent",
															isUsed ? "opacity-30 cursor-not-allowed" : ""
														)}
													>
														{isSelected && <div className="w-1 h-1 absolute inset-0 m-auto rounded-full bg-white" />}
													</button>
												);
											})}
										</div>
									</div>
								</div>
							) : (
								<div className="flex justify-between items-end w-full">
									<div className="flex flex-col">
										<span className="text-sm font-semibold text-foreground truncate">{category.name}</span>
										<span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
											{isUncategorized ? "Unbudgeted" : `${Math.min(100, Math.round(utilization))}% used`}
										</span>
									</div>
									<div className="flex items-baseline gap-1 flex-shrink-0 pl-2">
										<span
											className={cn("text-sm font-bold leading-none", isOverBudget ? "text-error" : "text-foreground")}
										>
											{formatCurrency(actualSpend)}
										</span>
										{!isUncategorized && (
											<span className="text-[10px] text-muted-foreground leading-none">
												/ {formatCurrency(category.budget_cap)}
											</span>
										)}
									</div>
								</div>
							)}

							{/* Progress Bar under name on mobile */}
							{!isEditing && (
								<div className="flex items-center gap-2 mt-2 w-full">
									<div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
										<div
											className={cn(
												"h-full rounded-full transition-all duration-500",
												!isUncategorized && isOverBudget
													? "bg-error"
													: isUncategorized
														? "bg-muted-foreground/30"
														: color.bg
											)}
											style={{ width: `${isUncategorized ? 100 : Math.min(utilization, 100)}%` }}
										/>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Right side: Actions */}
					<div className="flex flex-col flex-shrink-0 items-end gap-1 translate-y-[-2px]">
						{isEditing ? (
							<div className="flex flex-col gap-1 items-end pt-1">
								<div className="flex items-center gap-1">
									<Button size="icon" variant="ghost" className="h-6 w-6 text-success" onClick={handleSave}>
										<Check className="h-3.5 w-3.5" />
									</Button>
									<Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={handleCancel}>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						) : (
							!isUncategorized && (
								<div className="flex flex-col gap-0.5 w-[24px]">
									<Button
										size="icon"
										variant="ghost"
										className="h-6 w-6 text-muted-foreground hover:bg-primary/10 hover:text-primary"
										onClick={() => setIsEditing(true)}
									>
										<Pencil className="h-3 w-3" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-6 w-6 text-muted-foreground hover:bg-error/10 hover:text-error"
										onClick={() => setDeleteDialogOpen(true)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							)
						)}
					</div>
				</div>

				{/* ---------------- DESKTOP CARD LAYOUT (>= 768px) ---------------- */}
				<div className="hidden md:flex flex-col h-full">
					<div className="p-4 flex flex-col gap-4">
						{/* Header: Name and Budget */}
						<div className="flex justify-between items-start">
							<div className="flex items-center gap-2 max-w-[60%]">
								<div className={cn("w-1.5 h-6 rounded-full flex-shrink-0", color.bg)} />
								<div className="flex flex-col">
									{isEditing ? (
										<div className="flex flex-col gap-2">
											<Input
												value={nameValue}
												onChange={(e) => setNameValue(e.target.value)}
												onKeyDown={handleKeyDown}
												className="h-7 text-sm font-medium w-full"
												maxLength={100}
												autoFocus
											/>
										</div>
									) : (
										<>
											<span className="text-sm font-bold text-foreground truncate">{category.name}</span>
											<span className="text-xs text-muted-foreground mt-0.5">
												{isUncategorized ? "No budget set" : `${Math.min(100, Math.round(utilization))}% used`}
											</span>
										</>
									)}
								</div>
							</div>

							<div className="flex flex-col items-end flex-shrink-0">
								{isEditing ? (
									<div className="flex items-center gap-1 justify-end">
										<Input
											type="number"
											inputMode="decimal"
											value={budgetValue}
											onChange={(e) => setBudgetValue(e.target.value)}
											onKeyDown={handleKeyDown}
											className="h-7 w-20 text-sm font-bold"
										/>
									</div>
								) : (
									<>
										<span className="text-sm font-bold text-foreground">{formatCurrency(actualSpend)}</span>
										{!isUncategorized && (
											<span className="text-[10px] text-muted-foreground mt-0.5">
												of {formatCurrency(category.budget_cap)}
											</span>
										)}
									</>
								)}
							</div>
						</div>

						{isEditing && (
							<div className="flex flex-wrap gap-1.5 py-1">
								{CATEGORY_PALETTE.map((c) => {
									const colorName = Object.keys(COLOR_NAME_MAP).find(
										(key) => COLOR_NAME_MAP[key] === CATEGORY_PALETTE.indexOf(c)
									);
									if (!colorName) return null;

									const isSelected = selectedColor === colorName;
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
								{selectedColor && selectedColor !== category.color && usedColors.includes(selectedColor) && (
									<p className="text-[10px] text-error flex items-center gap-1 ml-auto">
										<AlertCircle className="h-2 w-2" />
										Taken
									</p>
								)}
							</div>
						)}

						{/* Progress Bar */}
						<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
							<div
								className={cn(
									"h-full rounded-full transition-all duration-500",
									!isUncategorized && isOverBudget ? "bg-error" : isUncategorized ? "bg-muted-foreground/30" : color.bg
								)}
								style={{ width: `${isUncategorized ? 100 : Math.min(utilization, 100)}%` }}
							/>
						</div>
					</div>

					{/* Footer: Status and Actions */}
					<div className="p-4 pt-1 flex justify-between items-center relative z-10">
						<div className="flex items-center text-xs font-medium">
							{isUncategorized ? (
								<span className="text-muted-foreground">Unbudgeted</span>
							) : isOverBudget ? (
								<span className="text-error flex items-center gap-1">{formatCurrency(amountRemainingOrOver)} over</span>
							) : (
								<span className="text-success">{formatCurrency(amountRemainingOrOver)} left</span>
							)}
						</div>

						<div
							className={cn(
								"flex items-center gap-1 transition-opacity",
								isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
							)}
						>
							{isEditing ? (
								<>
									<Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-success/20" onClick={handleSave}>
										<Check className="h-3.5 w-3.5 text-success" />
									</Button>
									<Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-muted" onClick={handleCancel}>
										<X className="h-3.5 w-3.5 text-muted-foreground" />
									</Button>
								</>
							) : !isUncategorized ? (
								<>
									<Button
										size="sm"
										variant="ghost"
										className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
										onClick={() => setIsEditing(true)}
									>
										<Pencil className="h-3 w-3" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-6 w-6 p-0 text-muted-foreground hover:text-error hover:bg-error/10"
										onClick={() => setDeleteDialogOpen(true)}
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</>
							) : null}
						</div>

						{/* Warning icon if over budget - static visual marker */}
						{!isEditing && !isUncategorized && isOverBudget && (
							<div className="absolute right-4 bottom-4 pointer-events-none text-error opacity-80 group-hover:opacity-0 transition-opacity">
								<AlertCircle className="h-3.5 w-3.5" />
							</div>
						)}
					</div>
				</div>
			</Card>

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
