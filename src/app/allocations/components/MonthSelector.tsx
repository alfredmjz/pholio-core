"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import type { MonthYear } from "../types";

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
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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

	const handleDateSelect = (date: Date | undefined) => {
		if (date) {
			onMonthChange({
				year: date.getFullYear(),
				month: date.getMonth() + 1,
			});
			setIsCalendarOpen(false);
		}
	};

	// Create a Date object for the current month
	const currentDate = new Date(currentMonth.year, currentMonth.month - 1);

	return (
		<div className="flex items-center gap-4">
			<Button
				variant="outline"
				size="icon"
				onClick={handlePrevMonth}
				className="h-9 w-9"
				aria-label="Previous month"
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			<div className="text-2xl font-bold text-foreground min-w-[200px] text-center">
				{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
			</div>

			<Button
				variant="outline"
				size="icon"
				onClick={handleNextMonth}
				className="h-9 w-9"
				aria-label="Next month"
			>
				<ChevronRight className="h-4 w-4" />
			</Button>

			<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="h-9 w-9"
						aria-label="Pick a date"
					>
						<CalendarIcon className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={currentDate}
						onSelect={handleDateSelect}
						defaultMonth={currentDate}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
