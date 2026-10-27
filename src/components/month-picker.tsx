"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	CALENDAR_MONTH_NAMES,
	CALENDAR_NAV_BUTTON,
	CALENDAR_YEARS_PER_PAGE,
	CalendarCaptionButton,
	CalendarGridOption,
} from "@/components/ui/calendar";
import { formatMonthYear } from "@/lib/date-utils";

interface MonthPickerProps {
	date?: Date;
	setDate: (date?: Date) => void;
	placeholder?: string;
	className?: string;
	align?: "center" | "start" | "end";
	customLabel?: React.ReactNode;
	/** Names the trigger when it shows only an icon. */
	ariaLabel?: string;
}

/**
 * Picks a month, in the same style as the date picker's month grid: the year reads left with the
 * arrows beside it, months are round, the picked one is filled with ink and this month is marked
 * in the accent colour. The year opens a grid of years.
 */
export function MonthPicker({
	date,
	setDate,
	placeholder = "Pick a month",
	className,
	align = "start",
	customLabel,
	ariaLabel,
}: MonthPickerProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [viewYear, setViewYear] = React.useState<number>(date?.getFullYear() ?? new Date().getFullYear());
	const [view, setView] = React.useState<"months" | "years">("months");
	const [yearPageStart, setYearPageStart] = React.useState(viewYear - 3);
	const today = new Date();

	React.useEffect(() => {
		if (isOpen) {
			setViewYear(date?.getFullYear() ?? today.getFullYear());
			setView("months");
		}
	}, [isOpen]);

	const openYears = () => {
		// The shown year sits in the second row, with earlier and later years around it.
		setYearPageStart(viewYear - 3);
		setView("years");
	};

	const isMonths = view === "months";

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant={"outline"}
					aria-label={ariaLabel}
					className={cn(
						"w-full justify-start text-left font-normal transform-none transition-none",
						!date && "text-primary",
						className
					)}
				>
					{!customLabel && <CalendarIcon className="mr-2 h-4 w-4" />}
					{customLabel ? customLabel : date ? formatMonthYear(date) : <span>{placeholder}</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto rounded-2xl p-1" align={align}>
				<div className="flex w-[17.25rem] flex-col p-3 [--cell-size:2.25rem]">
					<div className="flex h-[--cell-size] items-center justify-between pl-1">
						{isMonths ? (
							<CalendarCaptionButton onClick={openYears} label={`Choose year, ${viewYear}`}>
								{viewYear}
							</CalendarCaptionButton>
						) : (
							<button
								type="button"
								onClick={() => setView("months")}
								className="type-body flex h-8 items-center gap-1 rounded-full px-2 font-semibold text-primary transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label="Back to months"
							>
								{yearPageStart} – {yearPageStart + CALENDAR_YEARS_PER_PAGE - 1}
								<ChevronDownIcon className="size-3.5 rotate-180 text-muted-foreground" aria-hidden />
							</button>
						)}
						<div className="flex items-center gap-0.5">
							<Button
								type="button"
								variant="ghost"
								className={CALENDAR_NAV_BUTTON}
								onClick={() =>
									isMonths ? setViewYear(viewYear - 1) : setYearPageStart(yearPageStart - CALENDAR_YEARS_PER_PAGE)
								}
								aria-label={isMonths ? "Previous year" : "Earlier years"}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								className={CALENDAR_NAV_BUTTON}
								onClick={() =>
									isMonths ? setViewYear(viewYear + 1) : setYearPageStart(yearPageStart + CALENDAR_YEARS_PER_PAGE)
								}
								aria-label={isMonths ? "Next year" : "Later years"}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
					</div>

					<div
						className="mt-3 grid grid-cols-3 gap-x-1.5 gap-y-2"
						role="group"
						aria-label={isMonths ? `Months of ${viewYear}` : "Years"}
					>
						{isMonths
							? CALENDAR_MONTH_NAMES.map((name, index) => (
									<CalendarGridOption
										key={name}
										isCurrent={date?.getFullYear() === viewYear && date?.getMonth() === index}
										isNow={viewYear === today.getFullYear() && index === today.getMonth()}
										disabled={false}
										onClick={() => {
											setDate(new Date(viewYear, index, 1));
											setIsOpen(false);
										}}
									>
										{name}
									</CalendarGridOption>
								))
							: Array.from({ length: CALENDAR_YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((year) => (
									<CalendarGridOption
										key={year}
										isCurrent={year === viewYear}
										isNow={year === today.getFullYear()}
										disabled={false}
										onClick={() => {
											setViewYear(year);
											setView("months");
										}}
									>
										{year}
									</CalendarGridOption>
								))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
