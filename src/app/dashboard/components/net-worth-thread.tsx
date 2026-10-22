"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatFullDate, parseLocalDate } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";
import type { NetWorthPoint } from "../net-worth-series";

interface NetWorthThreadProps {
	points: Pick<NetWorthPoint, "date" | "value">[];
	/** Accessible name of the slider; the account page reuses the thread for one account's balance. */
	label?: string;
	/** Net worth at the start of the range, drawn as a dashed reference line. */
	baseline: number;
	activeIndex: number | null;
	onActiveChange: (index: number | null) => void;
	/** Changing this replays the draw-in animation (e.g. on range change). */
	animationKey: string;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 26;
const PAD_RIGHT = 10;

/**
 * Monotone cubic interpolation (Fritsch–Carlson), so the curve never overshoots a real balance
 * the way a plain Bézier smoothing would.
 */
function monotonePath(xs: number[], ys: number[]): string {
	const n = xs.length;
	if (n === 0) return "";
	if (n === 1) return `M ${xs[0]} ${ys[0]}`;

	const slopes: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		const dx = xs[i + 1] - xs[i];
		slopes.push(dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx);
	}

	const tangents: number[] = [slopes[0]];
	for (let i = 1; i < n - 1; i++) {
		tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
	}
	tangents.push(slopes[n - 2]);

	for (let i = 0; i < n - 1; i++) {
		if (slopes[i] === 0) {
			tangents[i] = 0;
			tangents[i + 1] = 0;
			continue;
		}
		const a = tangents[i] / slopes[i];
		const b = tangents[i + 1] / slopes[i];
		const h = a * a + b * b;
		if (h > 9) {
			const t = 3 / Math.sqrt(h);
			tangents[i] = t * a * slopes[i];
			tangents[i + 1] = t * b * slopes[i];
		}
	}

	let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
	for (let i = 0; i < n - 1; i++) {
		const dx = (xs[i + 1] - xs[i]) / 3;
		d += ` C ${(xs[i] + dx).toFixed(2)} ${(ys[i] + tangents[i] * dx).toFixed(2)}, ${(xs[i + 1] - dx).toFixed(2)} ${(
			ys[i + 1] -
			tangents[i + 1] * dx
		).toFixed(2)}, ${xs[i + 1].toFixed(2)} ${ys[i + 1].toFixed(2)}`;
	}
	return d;
}

function useWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	return { ref, width };
}

export function NetWorthThread({
	points,
	label = "Net worth over time",
	baseline,
	activeIndex,
	onActiveChange,
	animationKey,
}: NetWorthThreadProps) {
	const { ref, width } = useWidth<HTMLDivElement>();
	const [height, setHeight] = useState(220);

	useEffect(() => {
		const query = window.matchMedia("(min-width: 768px)");
		const update = () => setHeight(query.matches ? 230 : 170);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	const geometry = useMemo(() => {
		if (width === 0 || points.length === 0) return null;

		const times = points.map((p) => parseLocalDate(p.date).getTime());
		const first = times[0];
		const span = Math.max(1, times[times.length - 1] - first);
		const right = width - PAD_RIGHT;
		const xs = points.length === 1 ? [right] : times.map((t) => ((t - first) / span) * right);

		const values = points.map((p) => p.value);
		let min = Math.min(baseline, ...values);
		let max = Math.max(baseline, ...values);
		if (max - min < 1) {
			min -= 1;
			max += 1;
		}
		const pad = (max - min) * 0.12;
		min -= pad;
		max += pad;
		const plot = height - PAD_TOP - PAD_BOTTOM;
		const y = (value: number) => PAD_TOP + (1 - (value - min) / (max - min)) * plot;
		const ys = values.map(y);

		const path = points.length === 1 ? `M 0 ${ys[0]} L ${right} ${ys[0]}` : monotonePath(xs, ys);
		return { xs, ys, path, baselineY: y(baseline), right };
	}, [points, baseline, width, height]);

	const nearestIndex = (x: number) => {
		if (!geometry) return null;
		const { xs } = geometry;
		let low = 0;
		let high = xs.length - 1;
		while (low < high) {
			const mid = (low + high) >> 1;
			if (xs[mid] < x) low = mid + 1;
			else high = mid;
		}
		if (low > 0 && Math.abs(xs[low - 1] - x) < Math.abs(xs[low] - x)) low--;
		return low;
	};

	const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		onActiveChange(nearestIndex(event.clientX - rect.left));
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const last = points.length - 1;
		const current = activeIndex ?? last;
		let next: number | null = current;
		if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
		else if (event.key === "ArrowRight") next = Math.min(last, current + 1);
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = last;
		else if (event.key === "Escape") next = null;
		else return;
		event.preventDefault();
		onActiveChange(next);
	};

	const lastIndex = points.length - 1;
	const shownIndex = activeIndex ?? lastIndex;
	const shown = points[shownIndex];

	return (
		<div
			ref={ref}
			role="slider"
			tabIndex={0}
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={lastIndex}
			aria-valuenow={shownIndex}
			aria-valuetext={shown ? `${formatFullDate(shown.date)}: ${formatCurrency(shown.value, { showCents: true })}` : ""}
			className="dash-thread relative w-full select-none"
			style={{ height }}
			onPointerMove={handlePointer}
			onPointerDown={handlePointer}
			onPointerLeave={() => onActiveChange(null)}
			onKeyDown={handleKeyDown}
			onBlur={() => onActiveChange(null)}
		>
			{geometry && (
				<svg width={width} height={height} className="block overflow-visible" aria-hidden>
					<line
						x1={0}
						x2={geometry.right}
						y1={geometry.baselineY}
						y2={geometry.baselineY}
						className="dash-thread-baseline"
					/>

					<g key={animationKey}>
						<path d={geometry.path} pathLength={1} className="dash-thread-line dash-thread-shadow" />
						<path d={geometry.path} pathLength={1} className="dash-thread-line" />
					</g>

					{activeIndex !== null && (
						<g>
							<line
								x1={geometry.xs[activeIndex]}
								x2={geometry.xs[activeIndex]}
								y1={PAD_TOP - 8}
								y2={height - PAD_BOTTOM + 4}
								className="dash-thread-scrub"
							/>
							<circle
								cx={geometry.xs[activeIndex]}
								cy={geometry.ys[activeIndex]}
								r={4.5}
								className="fill-primary stroke-card"
								strokeWidth={2}
							/>
						</g>
					)}

					{activeIndex === null && (
						<g>
							<circle cx={geometry.xs[lastIndex]} cy={geometry.ys[lastIndex]} r={6} className="dash-live-ring" />
							<circle cx={geometry.xs[lastIndex]} cy={geometry.ys[lastIndex]} r={4.5} className="dash-live-dot" />
						</g>
					)}

					{/* The dashed swatch ties the start date to the dashed reference line. */}
					<line x1={0} x2={14} y1={height - 10} y2={height - 10} className="dash-thread-baseline" />
					<text x={20} y={height - 6} className="type-caption fill-muted-foreground">
						{formatFullDate(points[0].date)}
					</text>
					<text x={geometry.right} y={height - 6} textAnchor="end" className="type-caption fill-muted-foreground">
						Today
					</text>
				</svg>
			)}
		</div>
	);
}
