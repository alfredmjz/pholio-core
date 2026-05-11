/**
 * Centralized color palette and utilities for allocation categories.
 * Ensures consistent colors between progress bars (Tailwind) and charts (Hex).
 */

export interface CategoryColor {
	bg: string;
	text: string;
	light: string;
	hex: string;
}

export const CATEGORY_PALETTE: CategoryColor[] = [
	{ bg: "bg-cyan-500", text: "text-cyan-500", light: "bg-cyan-100", hex: "#06b6d4" },
	{ bg: "bg-green-500", text: "text-green-500", light: "bg-green-100", hex: "#10b981" },
	{ bg: "bg-amber-500", text: "text-amber-500", light: "bg-amber-100", hex: "#f59e0b" },
	{ bg: "bg-pink-500", text: "text-pink-500", light: "bg-pink-100", hex: "#ec4899" },
	{ bg: "bg-blue-500", text: "text-blue-500", light: "bg-blue-100", hex: "#3b82f6" },
	{ bg: "bg-red-500", text: "text-red-500", light: "bg-red-100", hex: "#ef4444" },
	{ bg: "bg-purple-500", text: "text-purple-500", light: "bg-purple-100", hex: "#a855f7" },
	{ bg: "bg-orange-500", text: "text-orange-500", light: "bg-orange-100", hex: "#f97316" },
	{ bg: "bg-indigo-500", text: "text-indigo-500", light: "bg-indigo-100", hex: "#6366f1" },
	{ bg: "bg-teal-500", text: "text-teal-500", light: "bg-teal-100", hex: "#14b8a6" },
	{ bg: "bg-lime-500", text: "text-lime-500", light: "bg-lime-100", hex: "#84cc16" },
	{ bg: "bg-violet-500", text: "text-violet-500", light: "bg-violet-100", hex: "#8b5cf6" },
	{ bg: "bg-fuchsia-500", text: "text-fuchsia-500", light: "bg-fuchsia-100", hex: "#d946ef" },
	{ bg: "bg-emerald-500", text: "text-emerald-500", light: "bg-emerald-100", hex: "#10b981" },
	{ bg: "bg-sky-500", text: "text-sky-500", light: "bg-sky-100", hex: "#0ea5e9" },
	{ bg: "bg-rose-500", text: "text-rose-500", light: "bg-rose-100", hex: "#f43f5e" },
	{ bg: "bg-gray-500", text: "text-gray-500", light: "bg-gray-100", hex: "#6b7280" },
];

export const COLOR_NAME_MAP: Record<string, number> = {
	cyan: 0,
	green: 1,
	amber: 2,
	pink: 3,
	blue: 4,
	red: 5,
	purple: 6,
	orange: 7,
	indigo: 8,
	teal: 9,
	lime: 10,
	violet: 11,
	fuchsia: 12,
	emerald: 13,
	sky: 14,
	rose: 15,
	gray: 16,
};

export function getCategoryColor(id: string, colorName?: string, index?: number): CategoryColor {
	if (colorName) {
		const normalizeName = colorName.toLowerCase();
		const paletteIndex = COLOR_NAME_MAP[normalizeName];
		if (paletteIndex !== undefined) {
			return CATEGORY_PALETTE[paletteIndex];
		}
	}

	// If no manual color, use stable index (display_order) if available, otherwise fallback to hash
	const finalIndex =
		index !== undefined
			? index % CATEGORY_PALETTE.length
			: (() => {
					let hash = 0;
					for (let i = 0; i < id.length; i++) {
						hash = id.charCodeAt(i) + ((hash << 5) - hash);
					}
					return Math.abs(hash) % CATEGORY_PALETTE.length;
				})();

	return CATEGORY_PALETTE[finalIndex];
}

export function getCategoryHex(id: string, colorName?: string, index?: number): string {
	return getCategoryColor(id, colorName, index).hex;
}

export function getNextAvailableColor(usedColorNames: string[]): string {
	const usedSet = new Set(usedColorNames.map((n) => n.toLowerCase()));
	const colorNames = Object.keys(COLOR_NAME_MAP);

	for (const name of colorNames) {
		if (!usedSet.has(name.toLowerCase())) {
			return name;
		}
	}

	// Fallback to the first color if all are used (unlikely with 16)
	return colorNames[0];
}
