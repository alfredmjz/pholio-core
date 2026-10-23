"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressLineProps {
	/** 0 to 100; values outside are clamped. */
	value: number;
	/** Background class for the filled wave, e.g. "bg-accent" or "bg-error". */
	tone?: string;
	/** When given, the bar is announced as a progress bar with this name; otherwise it's decorative. */
	label?: string;
	className?: string;
}

/**
 * The app's progress bar: the done part is a wave, the rest a flat faint track. It eases in
 * from empty when it first shows, the wave rolling in with it, then rests. Shape, size and speed come from CSS variables in
 * src/styles/surfaces.css, so themes can restyle every bar at once.
 */
export function ProgressLine({ value, tone = "bg-accent", label, className }: ProgressLineProps) {
	const target = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
	const [shown, setShown] = useState(0);

	// Start empty, then fill on the next frame so the width eases in.
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(target));
		return () => cancelAnimationFrame(frame);
	}, [target]);

	return (
		<div
			className={cn("progress-line w-full", className)}
			{...(label
				? {
						role: "progressbar",
						"aria-label": label,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": Math.round(target),
					}
				: { "aria-hidden": true })}
		>
			<span className="progress-line-track" style={{ left: `${shown}%` }} />
			<span className="progress-line-fill" style={{ width: `${shown}%` }}>
				{/* Keyed by the value, so a new value rolls the wave in again (once) as it fills. */}
				<span key={target} className={cn("progress-line-wave", tone)} />
			</span>
			<span className={cn("progress-line-dot", tone)} style={{ left: `${shown}%` }} />
		</div>
	);
}
