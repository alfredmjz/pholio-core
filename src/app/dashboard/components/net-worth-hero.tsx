"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { splitMoney } from "@/lib/format";
import {
	NET_WORTH_RANGES,
	rangeStartDate,
	seriesChange,
	sliceSeries,
	type NetWorthPoint,
	type NetWorthRange,
} from "../net-worth-series";
import { NetWorthThread } from "./net-worth-thread";

interface NetWorthHeroProps {
	today: string;
	history: NetWorthPoint[];
	totalAssets: number;
	totalLiabilities: number;
}

const RANGE_LABELS: Record<NetWorthRange, string> = {
	"1M": "the last month",
	"3M": "the last 3 months",
	"6M": "the last 6 months",
	"1Y": "the last year",
};

/** Animates from `from` to `to` once on mount, the page's single load-in moment. */
function useCountUp(from: number, to: number) {
	const [value, setValue] = useState(to);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) return;
		let frame = 0;
		const start = performance.now();
		const duration = 1400;
		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - progress, 3);
			setValue(from + (to - from) * eased);
			if (progress < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
		// Mount only: later updates (range changes, scrubbing) should not replay it.
	}, []);

	return value;
}

export function NetWorthHero({ today, history, totalAssets, totalLiabilities }: NetWorthHeroProps) {
	const [range, setRange] = useState<NetWorthRange>("3M");
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	const points = useMemo(() => sliceSeries(history, rangeStartDate(range, today)), [history, range, today]);
	const change = seriesChange(points);
	const current = points[points.length - 1]?.value ?? 0;
	const baseline = points[0]?.value ?? 0;

	const counted = useCountUp(baseline, current);
	const active = activeIndex !== null ? points[activeIndex] : null;
	const shownValue = active ? active.value : counted;
	const { whole, cents } = splitMoney(shownValue);

	const activeChange = active ? active.value - baseline : change.amount;
	const rising = activeChange >= 0;
	const hasHistory = points.length > 1;

	return (
		<section aria-labelledby="net-worth-heading" className="relative">
			<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
				<div className="min-w-0">
					<h2 id="net-worth-heading" className="type-label text-muted-foreground">
						Net worth
					</h2>
					<p className="dash-figure mt-3" aria-live="off">
						<span>{whole}</span>
						<span className="dash-figure-cents">{cents}</span>
					</p>

					<p className="type-body-sm mt-3 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
						{hasHistory && (
							<span
								className={cn(
									"inline-flex items-center gap-1 rounded-full px-2 py-0.5 type-label tabular-nums",
									rising ? "bg-success-muted text-success" : "bg-error-muted text-error"
								)}
							>
								{rising ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
								{formatCurrency(activeChange, { showSign: true })}
								{!active && change.percent !== null && ` (${Math.abs(change.percent).toFixed(1)}%)`}
							</span>
						)}
						<span>
							{active
								? `on ${formatFullDate(active.date)}, compared with ${formatFullDate(points[0].date)}`
								: hasHistory
									? `over ${RANGE_LABELS[range]}`
									: "Balance changes will draw your line here."}
						</span>
					</p>
				</div>

				<ToggleGroup
					type="single"
					value={range}
					onValueChange={(value) => {
						if (!value) return;
						setRange(value as NetWorthRange);
						setActiveIndex(null);
					}}
					variant="segmented"
					aria-label="Time range"
					className="shrink-0 gap-0.5 rounded-full border border-border/70 bg-card/85 p-1"
				>
					{NET_WORTH_RANGES.map((option) => (
						<ToggleGroupItem
							key={option}
							value={option}
							aria-label={RANGE_LABELS[option]}
							className="h-7 min-w-10 rounded-full px-3 type-label"
						>
							{option}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</div>

			<div className="mt-6">
				<NetWorthThread
					points={points}
					baseline={baseline}
					activeIndex={activeIndex}
					onActiveChange={setActiveIndex}
					animationKey={range}
				/>
			</div>

			<dl className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
				<div className="flex items-baseline gap-2">
					<dt className="type-body-sm text-muted-foreground">You own</dt>
					<dd className="type-value text-primary">{formatCurrency(active ? active.assets : totalAssets)}</dd>
				</div>
				<div className="flex items-baseline gap-2">
					<dt className="type-body-sm text-muted-foreground">You owe</dt>
					<dd className="type-value text-primary">{formatCurrency(active ? active.liabilities : totalLiabilities)}</dd>
				</div>
				<Link
					href="/accounts"
					className="type-body-sm ml-auto text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
				>
					Open accounts
				</Link>
			</dl>
		</section>
	);
}
