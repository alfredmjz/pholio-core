import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import type { MonthPace, PaceStatus } from "../month-pace";
import { SurfaceSection } from "@/components/layout/surface-section";
import { PaceChart } from "./pace-chart";

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

const STATUS_LABEL: Record<Exclude<PaceStatus, "no_budget">, { text: string; tone: string }> = {
	under: { text: "Under pace", tone: "bg-success-muted text-success" },
	on_pace: { text: "On pace", tone: "bg-accent-muted text-accent" },
	over_pace: { text: "Over pace", tone: "bg-warning-muted text-warning" },
	over_budget: { text: "Over budget", tone: "bg-error-muted text-error" },
};

function daysPhrase(days: number) {
	return days === 1 ? "1 day" : `${days} days`;
}

function guidance(pace: MonthPace): string {
	if (pace.status === "over_budget") {
		return `${formatCurrency(pace.spent - pace.budget)} past your ${formatCurrency(pace.budget)} budget with ${daysPhrase(pace.daysLeft)} to go.`;
	}
	const allowance = `About ${formatCurrency(pace.dailyAllowance)} a day keeps you on budget`;
	if (pace.daysLeft === 0) return `${formatCurrency(pace.remaining)} of your budget is left today.`;
	return `${allowance} for the last ${daysPhrase(pace.daysLeft + 1)}.`;
}

interface MonthPaceCardProps {
	pace: MonthPace | null;
	/** YYYY-MM-DD, used to name the month when there is no budget yet. */
	today: string;
}

/** This month's spending against the Allocations budget, with where it should be by today. */
export function MonthPaceCard({ pace, today }: MonthPaceCardProps) {
	const monthName = MONTH_NAMES[(pace?.month ?? Number(today.slice(5, 7))) - 1];

	if (!pace || pace.status === "no_budget") {
		return (
			<SurfaceSection id="month-pace-heading" title={`${monthName} so far`}>
				<p className="type-body text-muted-foreground">
					Set a budget for {monthName} to see whether your spending is on track.
				</p>
				<Link
					href="/allocations"
					className="type-control mt-4 inline-flex h-9 items-center rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary-hover"
				>
					Set up {monthName}&apos;s budget
				</Link>
			</SurfaceSection>
		);
	}

	const status = STATUS_LABEL[pace.status];
	const gap = Math.abs(pace.difference);

	return (
		<SurfaceSection
			id="month-pace-heading"
			title={`${monthName} so far`}
			note={`Day ${pace.dayOfMonth} of ${pace.daysInMonth}`}
			action={{ label: "Open budget", href: "/allocations" }}
		>
			<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
				<p className="text-primary">
					<span className="type-h2 tabular-nums">{formatCurrency(pace.spent)}</span>
					<span className="type-body ml-2 text-muted-foreground">of {formatCurrency(pace.budget)} spent</span>
				</p>
				<span className={cn("type-label rounded-full px-2.5 py-1", status.tone)}>{status.text}</span>
			</div>

			<div className="mt-5">
				<PaceChart pace={pace} monthLabel={monthName.slice(0, 3)} />
			</div>

			<p className="type-body-sm mt-5 border-t border-border/70 pt-4 text-muted-foreground">
				{(pace.status === "under" || pace.status === "over_pace") && (
					<span className="text-primary">
						{formatCurrency(gap)} {pace.difference > 0 ? "more" : "less"} than expected.{" "}
					</span>
				)}
				{guidance(pace)}
				{pace.usesTypicalCurve && " Expected spending follows your usual pattern from past months."}
			</p>
		</SurfaceSection>
	);
}
