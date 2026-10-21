import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatContributionAmount, getContributionPlanLabel } from "@/lib/contribution-plans";
import {
	buildRoomMeter,
	getBudgetProgressPercent,
	getRoomMeterNote,
	getRoomUsedPercent,
	type RoomMeterNoteLevel,
} from "@/lib/contribution-room-meter";
import type { RegisteredPlan } from "@/app/balancesheet/types";
import type { ContributionSummary } from "@/lib/types/contribution";
import type { CategoryColor } from "../utils/colors";

/** Diagonal hatching laid over a segment's colour: "budgeted, not contributed yet". */
const HATCH_STYLE = {
	backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 3px, hsl(var(--card) / 0.7) 3px 6px)",
};

const NOTE_TONE: Record<RoomMeterNoteLevel, string> = {
	over: "text-error",
	warning: "text-warning",
	info: "text-muted-foreground",
};

/** This month's budget: contributed (solid) and still to contribute (hatched). */
function BudgetBar({
	contributed,
	budget,
	color,
	formatCurrency,
}: {
	contributed: number;
	budget: number;
	color: CategoryColor;
	formatCurrency: (amount: number) => string;
}) {
	const contributedPercent = getBudgetProgressPercent(contributed, budget);
	return (
		<div
			className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted"
			role="img"
			aria-label={`Contributed ${formatCurrency(contributed)} of this month's ${formatCurrency(budget)} budget`}
		>
			<div className={cn("h-full transition-all duration-500", color.bg)} style={{ width: `${contributedPercent}%` }} />
			{budget > 0 && contributedPercent < 100 && (
				<div className={cn("h-full flex-1 opacity-40", color.bg)} style={HATCH_STYLE} />
			)}
		</div>
	);
}

interface ContributionRoomMeterProps {
	plan: RegisteredPlan;
	pool: ContributionSummary | null | undefined;
	budget: number;
	color: CategoryColor;
	year: number;
	formatCurrency: (amount: number) => string;
	/** One caption line for tight spaces (mobile rows). */
	compact?: boolean;
	className?: string;
}

/**
 * A budget category linked to a registered plan, in two clearly separate parts:
 *  1. this month's budget: contributed (solid) and still to contribute (hatched);
 *  2. below a divider, the plan's annual room left across all its accounts (capped by the
 *     total room left), used only by real contributions. The budget never uses room; it
 *     only raises a warning when the rest of it would not fit in the room left.
 * The figures come from buildRoomMeter / getRoomMeterNote (src/lib/contribution-room-meter.ts).
 */
export function ContributionRoomMeter({
	plan,
	pool,
	budget,
	color,
	year,
	formatCurrency,
	compact = false,
	className,
}: ContributionRoomMeterProps) {
	const planLabel = getContributionPlanLabel(plan);
	const contributed = pool?.month_contributions ?? 0;
	const meter = pool ? buildRoomMeter(pool, plan, budget, year) : null;
	const budgetBar = (
		<BudgetBar contributed={contributed} budget={budget} color={color} formatCurrency={formatCurrency} />
	);

	if (!meter) {
		return (
			<div className={cn("flex flex-col gap-2", className)}>
				{budgetBar}
				<p className="type-caption text-muted-foreground">
					No {planLabel} room yet.{" "}
					<Link
						href="/balancesheet"
						className="underline underline-offset-2 hover:text-primary"
						onPointerDown={(event) => event.stopPropagation()}
					>
						Track it on a {planLabel} account
					</Link>
				</p>
			</div>
		);
	}

	const leftLabel = `${meter.label.charAt(0).toUpperCase()}${meter.label.slice(1)} left`;
	// Room and tax are CRA figures, tracked to the cent; the budget keeps the card's format.
	const formatRoom = (amount: number) => formatContributionAmount(amount);
	const leftAmount = formatRoom(Math.max(0, meter.left));
	const note = getRoomMeterNote(meter, plan, year, formatRoom);
	const isOver = note?.level === "over";

	if (compact) {
		const urgent = note && note.level !== "info" ? note : null;
		return (
			<div className={cn("flex flex-col gap-1.5", className)} data-testid="contribution-room-meter">
				{budgetBar}
				<p className={cn("type-caption", urgent ? NOTE_TONE[urgent.level] : "text-muted-foreground")}>
					{urgent ? urgent.text : `${leftLabel}: ${leftAmount}`}
				</p>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-3", className)} data-testid="contribution-room-meter">
			{budgetBar}
			<div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
				<div className="flex items-baseline justify-between gap-2 type-caption">
					<span className="text-muted-foreground">{leftLabel}</span>
					<span className={cn("tabular-nums", isOver ? "text-error" : "text-foreground")}>{leftAmount}</span>
				</div>
				<div
					className="h-1 w-full overflow-hidden rounded-full bg-muted"
					role="img"
					aria-label={`${leftLabel}: ${leftAmount} (${formatRoom(meter.used)} used of ${formatRoom(meter.total)})`}
				>
					<div
						className={cn(
							"h-full rounded-full transition-all duration-500",
							isOver ? "bg-error" : "bg-muted-foreground"
						)}
						style={{ width: `${getRoomUsedPercent(meter)}%` }}
						title={`Room used: ${formatRoom(meter.used)} of ${formatRoom(meter.total)}`}
					/>
				</div>
				{note && <p className={cn("type-caption", NOTE_TONE[note.level])}>{note.text}</p>}
			</div>
		</div>
	);
}
