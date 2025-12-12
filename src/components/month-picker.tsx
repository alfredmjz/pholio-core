"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface MonthPickerProps {
	date?: Date;
	setDate: (date?: Date) => void;
	placeholder?: string;
	className?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthPicker({ date, setDate, placeholder = "Pick a month", className }: MonthPickerProps) {
	const [viewYear, setViewYear] = React.useState<number>(new Date().getFullYear());
	const [isOpen, setIsOpen] = React.useState(false);

	React.useEffect(() => {
		if (date) {
			setViewYear(date.getFullYear());
		}
	}, [date, isOpen]);

	const handleMonthSelect = (monthIndex: number) => {
		// Create new date at 1st of month
		const newDate = new Date(viewYear, monthIndex, 1);
		setDate(newDate);
		setIsOpen(false);
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant={"outline"}
					className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground", className)}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{date ? format(date, "MMMM yyyy") : <span>{placeholder}</span>}
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
					{MONTH_NAMES.map((month, index) => {
						const isSelected = date?.getFullYear() === viewYear && date?.getMonth() === index;
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
	);
}
