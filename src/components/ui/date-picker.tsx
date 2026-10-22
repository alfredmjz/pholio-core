import { useState } from "react";
import { formatDateString, formatLongDate, parseLocalDate } from "@/lib/date-utils";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** How far back and ahead the month and year menus reach when `yearPicker` is on. */
const YEARS_BACK = 5;
const YEARS_AHEAD = 10;

interface DatePickerProps {
	value?: string;
	onChange: (date: string) => void;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
	id?: string;
	minDate?: string;
	maxDate?: string;
	/** Adds month and year menus to the calendar, for dates that can be months or years away. */
	yearPicker?: boolean;
}

export function DatePicker({
	value,
	onChange,
	disabled = false,
	className,
	placeholder = "Pick a date",
	id,
	minDate,
	maxDate,
	yearPicker = false,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);

	const selectedDate = value ? parseLocalDate(value) : undefined;
	const min = minDate ? parseLocalDate(minDate) : undefined;
	const max = maxDate ? parseLocalDate(maxDate) : undefined;
	const thisYear = new Date().getFullYear();

	const handleSelect = (date: Date | undefined) => {
		if (date) {
			onChange(formatDateString(date));
			setOpen(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					id={id}
					className={cn(
						"h-10 w-full justify-start rounded-[10px] border-field-border bg-field text-left font-normal text-primary hover:bg-field active:scale-100",
						!value && "text-muted-foreground",
						className
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
					{selectedDate ? formatLongDate(selectedDate) : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto rounded-2xl p-1" align="start">
				<Calendar
					mode="single"
					selected={selectedDate || new Date()}
					onSelect={handleSelect}
					autoFocus
					required
					disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
					defaultMonth={selectedDate ?? min}
					{...(yearPicker && {
						captionLayout: "dropdown" as const,
						startMonth: min ?? new Date(thisYear - YEARS_BACK, 0),
						endMonth: max ?? new Date(thisYear + YEARS_AHEAD, 11),
					})}
				/>
			</PopoverContent>
		</Popover>
	);
}
