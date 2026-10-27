import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames, type MonthCaptionProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type CalendarProps = ComponentProps<typeof DayPicker> & {
	buttonVariant?: ComponentProps<typeof Button>["variant"];
};

/**
 * The app's date grid, in the redesign's paper-and-ink style: the month reads left like a
 * heading with the arrows beside it, days are round, a picked day is filled with ink, and
 * today is marked in the accent colour only.
 *
 * With `captionLayout="dropdown"` the month and year in the heading become buttons that open
 * a month grid and a year grid inside the calendar (bounded by `startMonth`/`endMonth`), for
 * dates that can be months or years away.
 */
function Calendar(props: CalendarProps) {
	if (props.captionLayout === "dropdown") return <PickableCalendar {...props} />;
	return <DayGrid {...props} />;
}

const NAV_BUTTON =
	"h-[--cell-size] w-[--cell-size] select-none rounded-full p-0 text-muted-foreground hover:bg-primary/[0.05] hover:text-primary aria-disabled:opacity-40 disabled:opacity-40";

function DayGrid({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = "label",
	buttonVariant = "ghost",
	formatters,
	components,
	...props
}: CalendarProps) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn(
				"group/calendar bg-transparent p-3 [--cell-size:2.25rem]",
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className
			)}
			captionLayout={captionLayout}
			formatters={formatters}
			classNames={{
				root: cn("w-fit", defaultClassNames.root),
				months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
				month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
				// Arrows sit together on the right; the month reads on the left like a heading.
				nav: cn("absolute right-0 top-0 flex items-center gap-0.5", defaultClassNames.nav),
				button_previous: cn(buttonVariants({ variant: buttonVariant }), NAV_BUTTON, defaultClassNames.button_previous),
				button_next: cn(buttonVariants({ variant: buttonVariant }), NAV_BUTTON, defaultClassNames.button_next),
				month_caption: cn(
					"flex h-[--cell-size] w-full items-center pl-1 pr-[calc(var(--cell-size)*2+0.5rem)]",
					defaultClassNames.month_caption
				),
				caption_label: cn("type-body select-none font-semibold text-primary", defaultClassNames.caption_label),
				table: "w-full border-collapse",
				weekdays: cn("flex", defaultClassNames.weekdays),
				weekday: cn("type-body-xs flex-1 select-none font-normal text-muted-foreground", defaultClassNames.weekday),
				week: cn("mt-1 flex w-full", defaultClassNames.week),
				week_number_header: cn("w-[--cell-size] select-none", defaultClassNames.week_number_header),
				week_number: cn("type-body-xs select-none text-muted-foreground", defaultClassNames.week_number),
				day: cn("group/day relative aspect-square h-full w-full select-none p-0 text-center", defaultClassNames.day),
				range_start: cn("rounded-l-full bg-primary/[0.08]", defaultClassNames.range_start),
				range_middle: cn("rounded-none bg-primary/[0.08]", defaultClassNames.range_middle),
				range_end: cn("rounded-r-full bg-primary/[0.08]", defaultClassNames.range_end),
				// Today is marked by colour only, so a filled day always means a picked day.
				today: cn("font-semibold text-accent", defaultClassNames.today),
				outside: cn("text-muted-foreground/50", defaultClassNames.outside),
				disabled: cn("text-muted-foreground opacity-40", defaultClassNames.disabled),
				hidden: cn("invisible", defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: ({ className, rootRef, ...props }) => {
					return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
				},
				Chevron: ({ className, orientation, ...props }) => {
					if (orientation === "left") {
						return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
					}

					if (orientation === "right") {
						return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
					}

					return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
				},
				DayButton: CalendarDayButton,
				WeekNumber: ({ children, ...props }) => {
					return (
						<td {...props}>
							<div className="flex size-[--cell-size] items-center justify-center text-center">{children}</div>
						</td>
					);
				},
				...components,
			}}
			{...props}
		/>
	);
}

// ---------------------------------------------------------------------------------------------
// Month and year picking inside the calendar
// ---------------------------------------------------------------------------------------------

type View = "days" | "months" | "years";

const YEARS_PER_PAGE = 12;
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
	new Date(2000, i, 1).toLocaleString("default", { month: "short" })
);

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();

/** A heading button ("October ▾") that opens the month or year grid. */
function CaptionButton({
	onClick,
	label,
	expanded,
	children,
}: {
	onClick: () => void;
	label: string;
	expanded?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			aria-expanded={expanded}
			className="type-body flex h-8 items-center gap-1 rounded-full px-2 font-semibold text-primary transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{children}
			<ChevronDownIcon
				className={cn("size-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")}
				aria-hidden
			/>
		</button>
	);
}

/** One choice in the month or year grid: filled when it's the one shown, accent when it's now. */
function GridOption({
	isCurrent,
	isNow,
	disabled,
	onClick,
	children,
}: {
	isCurrent: boolean;
	isNow: boolean;
	disabled: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={isCurrent}
			autoFocus={isCurrent}
			className={cn(
				"type-body-sm h-11 rounded-full tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
				isCurrent
					? "bg-primary font-medium text-primary-foreground"
					: cn("hover:bg-primary/[0.05] hover:text-primary", isNow ? "font-semibold text-accent" : "text-primary")
			)}
		>
			{children}
		</button>
	);
}

function PickableCalendar({
	month: controlledMonth,
	onMonthChange,
	defaultMonth,
	startMonth,
	endMonth,
	components,
	className,
	...props
}: CalendarProps) {
	const selected = "selected" in props && props.selected instanceof Date ? props.selected : undefined;
	const today = new Date();

	const [internalMonth, setInternalMonth] = useState(() =>
		firstOfMonth(controlledMonth ?? defaultMonth ?? selected ?? today)
	);
	const shown = controlledMonth ? firstOfMonth(controlledMonth) : internalMonth;
	const [view, setView] = useState<View>("days");
	const [yearPageStart, setYearPageStart] = useState(shown.getFullYear());

	const inRange = (date: Date) =>
		(!startMonth || monthIndex(date) >= monthIndex(startMonth)) &&
		(!endMonth || monthIndex(date) <= monthIndex(endMonth));
	const yearInRange = (year: number) =>
		(!startMonth || year >= startMonth.getFullYear()) && (!endMonth || year <= endMonth.getFullYear());

	const showMonth = (date: Date) => {
		let next = firstOfMonth(date);
		if (startMonth && monthIndex(next) < monthIndex(startMonth)) next = firstOfMonth(startMonth);
		if (endMonth && monthIndex(next) > monthIndex(endMonth)) next = firstOfMonth(endMonth);
		if (!controlledMonth) setInternalMonth(next);
		onMonthChange?.(next);
	};

	const openYears = () => {
		// Page so the shown year sits in the second row, with earlier and later years around it.
		let start = shown.getFullYear() - 3;
		if (endMonth) start = Math.min(start, endMonth.getFullYear() - YEARS_PER_PAGE + 1);
		if (startMonth) start = Math.max(start, startMonth.getFullYear());
		setYearPageStart(start);
		setView("years");
	};

	// The grids take the day view's height, so the popover doesn't jump when switching.
	const daysRef = useRef<HTMLDivElement>(null);
	const [daysHeight, setDaysHeight] = useState<number>();
	useLayoutEffect(() => {
		if (view === "days" && daysRef.current) setDaysHeight(daysRef.current.offsetHeight);
	}, [view, shown.getTime()]);

	const year = shown.getFullYear();
	const monthName = shown.toLocaleString("default", { month: "long" });

	if (view === "days") {
		return (
			<div ref={daysRef} className="w-fit">
				<DayGrid
					{...props}
					className={className}
					captionLayout="label"
					month={shown}
					onMonthChange={showMonth}
					startMonth={startMonth}
					endMonth={endMonth}
					components={{
						MonthCaption: ({
							calendarMonth: _month,
							displayIndex: _index,
							children,
							...divProps
						}: MonthCaptionProps) => (
							<div {...divProps}>
								{/* Keeps the grid's accessible name; the buttons below are what people see. */}
								<span className="sr-only">{children}</span>
								<CaptionButton onClick={() => setView("months")} label={`Choose month, ${monthName}`}>
									{monthName}
								</CaptionButton>
								<CaptionButton onClick={openYears} label={`Choose year, ${year}`}>
									{year}
								</CaptionButton>
							</div>
						),
						...components,
					}}
				/>
			</div>
		);
	}

	const isMonths = view === "months";
	const prevDisabled = isMonths ? !yearInRange(year - 1) : !yearInRange(yearPageStart - 1);
	const nextDisabled = isMonths ? !yearInRange(year + 1) : !yearInRange(yearPageStart + YEARS_PER_PAGE);

	return (
		<div
			data-slot="calendar"
			className={cn("flex w-[calc(var(--cell-size)*7+1.5rem)] flex-col p-3 [--cell-size:2.25rem]", className)}
			style={{ minHeight: daysHeight }}
		>
			<div className="flex h-[--cell-size] items-center justify-between pl-1">
				{isMonths ? (
					<CaptionButton onClick={openYears} label={`Choose year, ${year}`}>
						{year}
					</CaptionButton>
				) : (
					<button
						type="button"
						onClick={() => setView("days")}
						className="type-body flex h-8 items-center gap-1 rounded-full px-2 font-semibold text-primary transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Back to days"
					>
						{yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}
						<ChevronDownIcon className="size-3.5 rotate-180 text-muted-foreground" aria-hidden />
					</button>
				)}
				<div className="flex items-center gap-0.5">
					<Button
						type="button"
						variant="ghost"
						className={NAV_BUTTON}
						disabled={prevDisabled}
						onClick={() =>
							isMonths
								? showMonth(new Date(year - 1, shown.getMonth(), 1))
								: setYearPageStart(yearPageStart - YEARS_PER_PAGE)
						}
						aria-label={isMonths ? "Previous year" : "Earlier years"}
					>
						<ChevronLeftIcon className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						className={NAV_BUTTON}
						disabled={nextDisabled}
						onClick={() =>
							isMonths
								? showMonth(new Date(year + 1, shown.getMonth(), 1))
								: setYearPageStart(yearPageStart + YEARS_PER_PAGE)
						}
						aria-label={isMonths ? "Next year" : "Later years"}
					>
						<ChevronRightIcon className="size-4" />
					</Button>
				</div>
			</div>

			<div
				className="mt-3 grid flex-1 grid-cols-3 content-center gap-x-1.5 gap-y-2"
				role="group"
				aria-label={isMonths ? `Months of ${year}` : "Years"}
			>
				{isMonths
					? MONTH_NAMES.map((name, i) => {
							const date = new Date(year, i, 1);
							return (
								<GridOption
									key={name}
									isCurrent={i === shown.getMonth()}
									isNow={year === today.getFullYear() && i === today.getMonth()}
									disabled={!inRange(date)}
									onClick={() => {
										showMonth(date);
										setView("days");
									}}
								>
									{name}
								</GridOption>
							);
						})
					: Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((option) => (
							<GridOption
								key={option}
								isCurrent={option === year}
								isNow={option === today.getFullYear()}
								disabled={!yearInRange(option)}
								onClick={() => {
									showMonth(new Date(option, shown.getMonth(), 1));
									setView("days");
								}}
							>
								{option}
							</GridOption>
						))}
			</div>
		</div>
	);
}

function CalendarDayButton({ className, day, modifiers, ...props }: ComponentProps<typeof DayButton>) {
	const defaultClassNames = getDefaultClassNames();

	const ref = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (modifiers.focused) ref.current?.focus();
	}, [modifiers.focused]);

	return (
		<Button
			ref={ref}
			variant="ghost"
			size="icon"
			data-day={day.date.toLocaleDateString()}
			data-selected-single={
				modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			className={cn(
				"type-body-sm flex aspect-square h-auto w-full min-w-[--cell-size] flex-col gap-1 rounded-full font-normal leading-none text-inherit tabular-nums",
				"hover:bg-primary/[0.05] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
				"group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-ring",
				"data-[selected-single=true]:bg-primary data-[selected-single=true]:font-medium data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:bg-primary/90",
				"data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-transparent",
				"[&>span]:text-xs [&>span]:opacity-70",
				defaultClassNames.day,
				className
			)}
			{...props}
		/>
	);
}

export {
	Calendar,
	CalendarDayButton,
	CaptionButton as CalendarCaptionButton,
	GridOption as CalendarGridOption,
	MONTH_NAMES as CALENDAR_MONTH_NAMES,
	NAV_BUTTON as CALENDAR_NAV_BUTTON,
	YEARS_PER_PAGE as CALENDAR_YEARS_PER_PAGE,
};
