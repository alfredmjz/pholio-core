"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_PALETTE, COLOR_NAME_MAP } from "../utils/colors";

const COLOR_NAMES = Object.keys(COLOR_NAME_MAP);

interface CategoryColorPickerProps {
	value: string | null;
	onChange: (color: string) => void;
	/** Colours other categories already use; they can't be picked. */
	usedColors: string[];
	/** This category's current colour, which stays pickable even though it's "used". */
	ownColor?: string | null;
	/** Colour shown as selected when nothing is picked yet. */
	fallback?: string | null;
}

/** Swatches for a budget category's colour, one per palette entry. */
export function CategoryColorPicker({ value, onChange, usedColors, ownColor, fallback }: CategoryColorPickerProps) {
	const shown = value ?? fallback ?? null;

	return (
		<fieldset>
			<legend className="type-label mb-2.5 text-primary">Colour</legend>
			<div className="flex flex-wrap gap-2">
				{COLOR_NAMES.map((colorName) => {
					const swatch = CATEGORY_PALETTE[COLOR_NAME_MAP[colorName]];
					const selected = shown === colorName;
					const taken = usedColors.includes(colorName) && colorName !== ownColor;
					return (
						<button
							key={colorName}
							type="button"
							disabled={taken}
							onClick={() => onChange(colorName)}
							aria-label={taken ? `${colorName} (used by another category)` : colorName}
							aria-pressed={selected}
							title={taken ? `${colorName} is used by another category` : colorName}
							className={cn(
								"flex h-7 w-7 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
								swatch.bg,
								selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
								taken ? "cursor-not-allowed opacity-25" : "hover:scale-110"
							)}
						>
							{selected && <Check className="h-3.5 w-3.5 text-white" aria-hidden />}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}
