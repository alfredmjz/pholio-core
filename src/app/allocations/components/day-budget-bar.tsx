"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { BudgetPace } from "../utils/month-pace";

interface DayBudgetBarProps {
	pace: BudgetPace;
	/** Background class for the spent part, e.g. a category's colour or "bg-error". */
	tone: string;
	/** Read out in place of the bar, e.g. "Spent $255 of $600. $345 left to spend in 18 days." */
	label: string;
	className?: string;
}

/**
 * A month's budget with one segment per day. Spending fills the segments from the left, days
 * already gone sit on a darker track, and in the current month a mark stands before today.
 * Spending past an even share through today shows lighter, so running ahead of pace is visible.
 * Styles live in src/styles/surfaces.css (.day-bar).
 */
export function DayBudgetBar({ pace, tone, label, className }: DayBudgetBarProps) {
	const { daysInMonth, daysElapsed, phase, filledDays, aheadBy } = pace;
	const isCurrent = phase === "current";

	// Start empty, then fill on the next frame so the segments fill in, left to right.
	const [shown, setShown] = useState(0);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(filledDays));
		return () => cancelAnimationFrame(frame);
	}, [filledDays]);

	return (
		<div className={cn("day-bar w-full", className)} role="img" aria-label={label}>
			{Array.from({ length: daysInMonth }, (_, day) => {
				const fill = Math.min(Math.max(shown - day, 0), 1);
				const isToday = isCurrent && day === daysElapsed;
				return (
					<span
						key={day}
						className="day-bar-cell"
						data-gone={day < daysElapsed || undefined}
						data-week-start={(day > 0 && day % 7 === 0) || undefined}
					>
						<span className="day-bar-track">
							<span
								className={cn("day-bar-fill", tone)}
								data-ahead={(aheadBy > 0 && day > daysElapsed) || undefined}
								style={{ width: `${fill * 100}%`, ["--day-index" as string]: day }}
							/>
						</span>
						{isToday && <span className="day-bar-today" />}
					</span>
				);
			})}
		</div>
	);
}
