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
		<div className="flex items-center gap-4">
			<Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-9 w-9" aria-label="Previous month">
				<ChevronLeft className="h-4 w-4" />
			</Button>

			<div className="text-2xl font-bold text-primary min-w-[200px] text-center">
				{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
			</div>

			<Button variant="outline" size="icon" onClick={handleNextMonth} className="h-9 w-9" aria-label="Next month">
				<ChevronRight className="h-4 w-4" />
			</Button>

			<MonthPicker
				date={currentDate}
				setDate={handleDateChange}
				customLabel={<CalendarIcon className="h-4 w-4 text-foreground" />}
				className="h-9 w-9 p-0 justify-center aspect-square"
				align="end"
			/>
		</div>
	);
}
