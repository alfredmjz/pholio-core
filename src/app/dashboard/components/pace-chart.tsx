import { formatCurrency } from "@/app/dashboard/utils";
import type { MonthPace } from "../month-pace";

const WIDTH = 300;
const HEIGHT = 96;
const PAD_Y = 6;

/**
 * Cumulative spending this month: the solid line is what has been spent so far, the dashed line
 * is where spending is expected to be on each day, ending at the budget.
 */
export function PaceChart({ pace, monthLabel }: { pace: MonthPace; monthLabel: string }) {
	const max = Math.max(pace.budget, ...pace.cumulative, 1);
	const x = (day: number) => ((day - 1) / Math.max(1, pace.daysInMonth - 1)) * WIDTH;
	const y = (value: number) => PAD_Y + (1 - value / max) * (HEIGHT - PAD_Y * 2);
	const line = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i + 1)} ${y(v)}`).join(" ");

	const tone =
		pace.status === "over_budget" ? "text-error" : pace.status === "over_pace" ? "text-warning" : "text-primary";
	const today = pace.cumulative.length;

	return (
		<figure className="m-0">
			<div className="relative" style={{ height: HEIGHT }}>
				<svg
					viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
					preserveAspectRatio="none"
					className="absolute inset-0 h-full w-full overflow-visible"
					role="img"
					aria-label={`Spent ${formatCurrency(pace.spent)} so far against ${formatCurrency(pace.expectedByToday)} expected by today`}
				>
					<line
						x1={0}
						x2={WIDTH}
						y1={y(pace.budget)}
						y2={y(pace.budget)}
						className="stroke-border"
						strokeWidth={1}
						vectorEffect="non-scaling-stroke"
					/>
					<path
						d={line(pace.expected)}
						fill="none"
						className="stroke-accent"
						strokeWidth={1.5}
						strokeDasharray="4 4"
						vectorEffect="non-scaling-stroke"
					/>
					{today > 0 && (
						<path
							d={line(pace.cumulative)}
							fill="none"
							className={`stroke-current ${tone}`}
							strokeWidth={2.25}
							strokeLinejoin="round"
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
						/>
					)}
				</svg>
				{/* An HTML dot stays round however the chart is stretched. */}
				{today > 0 && (
					<span
						className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-current ${tone}`}
						style={{
							left: `${(x(today) / WIDTH) * 100}%`,
							top: `${(y(pace.cumulative[today - 1]) / HEIGHT) * 100}%`,
						}}
						aria-hidden
					/>
				)}
			</div>
			<figcaption className="type-body-xs mt-2.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span className="w-4 border-t-[1.5px] border-dashed border-accent" aria-hidden />
					Expected by today {formatCurrency(pace.expectedByToday)}
				</span>
				<span className="tabular-nums">
					{formatCurrency(pace.remaining)} left of {formatCurrency(pace.budget)} by {monthLabel} {pace.daysInMonth}
				</span>
			</figcaption>
		</figure>
	);
}
