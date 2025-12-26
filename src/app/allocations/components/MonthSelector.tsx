"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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

const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthSelector({ currentMonth, onMonthChange }: MonthSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [viewYear, setViewYear] = useState(currentMonth.year);

	// Sync view year when currentMonth changes externally
	useEffect(() => {
		setViewYear(currentMonth.year);
	}, [currentMonth.year, isOpen]);

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

	const handleMonthSelect = (monthIndex: number) => {
		onMonthChange({
			year: viewYear,
			month: monthIndex + 1,
		});
		setIsOpen(false);
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

			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" size="icon" className="h-9 w-9" aria-label="Pick a month">
						<CalendarIcon className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-3" align="start">
					{/* Year Navigation */}
					<div className="flex items-center justify-between mb-2">
						<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(viewYear - 1)}>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="font-semibold">{viewYear}</span>
						<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear(viewYear + 1)}>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>

					{/* Month Grid */}
					<div className="grid grid-cols-3 gap-2">
						{SHORT_MONTH_NAMES.map((month, index) => {
							const isSelected = viewYear === currentMonth.year && index + 1 === currentMonth.month;
							const isCurrentMonth = new Date().getFullYear() === viewYear && new Date().getMonth() === index;

							return (
								<Button
									key={month}
									variant={isSelected ? "default" : "outline"}
									size="sm"
									className={cn(
										"h-9 text-xs",
										!isSelected && isCurrentMonth && "border-primary/50 text-primary font-semibold"
									)}
									onClick={() => handleMonthSelect(index)}
								>
									{month}
								</Button>
							);
						})}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
