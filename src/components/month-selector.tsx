"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { MonthPicker } from "@/components/month-picker";
import type { MonthYear } from "@/app/allocations/types";

interface MonthSelectorProps {
	currentMonth: MonthYear;
	onMonthChange: (month: MonthYear) => void;
}

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export function MonthSelector({ currentMonth, onMonthChange }: MonthSelectorProps) {
	const currentDate = new Date(currentMonth.year, currentMonth.month - 1);

	const handlePrevMonth = () => {
		if (currentMonth.month === 1) {
			onMonthChange({ year: currentMonth.year - 1, month: 12 });
		} else {
			onMonthChange({ year: currentMonth.year, month: currentMonth.month - 1 });
		}
	};

	const handleNextMonth = () => {
		if (currentMonth.month === 12) {
			onMonthChange({ year: currentMonth.year + 1, month: 1 });
		} else {
			onMonthChange({ year: currentMonth.year, month: currentMonth.month + 1 });
		}
	};

	const handleDateChange = (date: Date | undefined) => {
		if (date) {
			onMonthChange({
				year: date.getFullYear(),
				month: date.getMonth() + 1,
			});
		}
	};

	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
			<h1 className="type-h3 whitespace-nowrap text-primary sm:type-h2">
				{MONTH_NAMES[currentMonth.month - 1]} <span className="text-muted-foreground">{currentMonth.year}</span>
			</h1>

			<div className="flex shrink-0 items-center rounded-full border border-border/70 bg-card/85 p-0.5">
				<Button
					variant="ghost"
					size="icon"
					onClick={handlePrevMonth}
					className="h-8 w-8 rounded-full"
					aria-label="Previous month"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<MonthPicker
					date={currentDate}
					setDate={handleDateChange}
					customLabel={<CalendarIcon className="h-4 w-4 text-foreground" />}
					ariaLabel="Choose month"
					className="h-8 w-8 shrink-0 justify-center rounded-full border-0 bg-transparent p-0 shadow-none hover:bg-hover"
					align="start"
				/>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleNextMonth}
					className="h-8 w-8 rounded-full"
					aria-label="Next month"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
