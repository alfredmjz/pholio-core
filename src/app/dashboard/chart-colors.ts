/**
 * Chart Color Palette
 * Consistent colors for data visualization across the application
 */

/**
 * Color palette for asset categories in charts
 */
export const ASSET_COLORS = [
	"#337EA9", // Blue - Banking
	"#448361", // Green - Investment
	"#CB912F", // Yellow - Retirement
	"#9065B0", // Purple - Property
	"#3b82f6", // Light Blue - Other
] as const;

/**
 * Color palette for liability categories in charts
 */
export const LIABILITY_COLORS = [
	"#D44C47", // Red - Credit
	"#C14C8A", // Pink - Debt
	"#D9730D", // Orange - Other
] as const;

/**
 * General purpose chart colors (for categories, series, etc.)
 */
export const CHART_COLORS = [
	"#06b6d4", // Cyan
	"#10b981", // Emerald
	"#f59e0b", // Amber
	"#ec4899", // Pink
	"#3b82f6", // Blue
	"#ef4444", // Red
	"#8b5cf6", // Purple
	"#f97316", // Orange
] as const;

/**
 * Semantic colors that map to CSS variables
 */
export const SEMANTIC_COLORS = {
	income: "var(--info)",
	expense: "var(--error)",
	success: "var(--success)",
	warning: "var(--warning)",
	neutral: "var(--muted)",
} as const;

/**
 * Get a color for a category by index
 * @param index - Category index
 * @param type - 'asset' or 'liability'
 * @returns Hex color string
 */
export function getCategoryColor(
	index: number,
	type: "asset" | "liability"
): string {
	const colors = type === "asset" ? ASSET_COLORS : LIABILITY_COLORS;
	return colors[index % colors.length];
}

/**
 * Get a chart color by index
 * @param index - Series/category index
 * @returns Hex color string
 */
export function getChartColor(index: number): string {
	return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Get Tailwind CSS class for a category color
 * @param index - Category index
 * @returns Object with bg and text Tailwind classes
 */
export function getCategoryColorClasses(index: number): {
	bg: string;
	text: string;
	border: string;
} {
	const colorMap = [
		{ bg: "bg-cyan-500", text: "text-cyan-500", border: "border-cyan-500" },
		{
			bg: "bg-emerald-500",
			text: "text-emerald-500",
			border: "border-emerald-500",
		},
		{ bg: "bg-amber-500", text: "text-amber-500", border: "border-amber-500" },
		{ bg: "bg-pink-500", text: "text-pink-500", border: "border-pink-500" },
		{ bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500" },
		{ bg: "bg-red-500", text: "text-red-500", border: "border-red-500" },
		{
			bg: "bg-purple-500",
			text: "text-purple-500",
			border: "border-purple-500",
		},
		{
			bg: "bg-orange-500",
			text: "text-orange-500",
			border: "border-orange-500",
		},
	];
	return colorMap[index % colorMap.length];
}
