import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
	value?: string;
	onChange: (date: string) => void;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
	id?: string;
	minDate?: string;
	maxDate?: string;
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
}: DatePickerProps) {
	const [open, setOpen] = useState(false);

	// Force local time interpretation by appending T00:00:00 to YYYY-MM-DD string
	const selectedDate = value ? new Date(value + "T00:00:00") : undefined;

	const handleSelect = (date: Date | undefined) => {
		if (date) {
			onChange(format(date, "yyyy-MM-dd"));
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
						"w-full justify-start text-left font-normal h-10 active:scale-100",
						!value && "text-muted-foreground",
						className
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{selectedDate ? format(selectedDate, "PPP") : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={selectedDate || new Date()}
					onSelect={handleSelect}
					autoFocus
					required
					disabled={[
						...(minDate ? [{ before: new Date(minDate + "T00:00:00") }] : []),
						...(maxDate ? [{ after: new Date(maxDate + "T00:00:00") }] : []),
					]}
					defaultMonth={minDate ? new Date(minDate + "T00:00:00") : undefined}
				/>
			</PopoverContent>
		</Popover>
	);
}
