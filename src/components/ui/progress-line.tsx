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
	/** Changing it rolls the wave once more in place, without refilling (e.g. after a drop). */
	replayKey?: string | number;
}

/**
 * The app's progress bar: the done part is a wave, the rest a flat faint track. It eases in
 * from empty when it first shows, the wave rolling in with it, then rests. Shape, size and speed come from CSS variables in
 * src/styles/surfaces.css, so themes can restyle every bar at once.
 */
/** A little past --progress-duration (1.2s) in src/styles/surfaces.css. */
const WAVE_SETTLE_MS = 1_400;

export function ProgressLine({ value, tone = "bg-accent", label, className, replayKey }: ProgressLineProps) {
	const target = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
	const [shown, setShown] = useState(0);
	const waveKey = `${target}:${replayKey ?? ""}`;
	const [settledKey, setSettledKey] = useState<string | null>(null);

	// Start empty, then fill on the next frame so the width eases in.
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(target));
		return () => cancelAnimationFrame(frame);
	}, [target]);

	// Settle even if the end of the roll is never reported (a tab opened in the background).
	useEffect(() => {
		const timer = setTimeout(() => setSettledKey(waveKey), WAVE_SETTLE_MS);
		return () => clearTimeout(timer);
	}, [waveKey]);

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
				{/* Keyed by the value, so a new value rolls the wave in again (once) as it fills. Once it
				    has rolled it is marked settled: a browser replays CSS animations on an element that
				    moves in the page (a reordered list row), and a settled wave has none to replay. */}
				<span
					key={waveKey}
					data-settled={settledKey === waveKey ? "true" : undefined}
					onAnimationEnd={(event) => {
						if (event.target === event.currentTarget) setSettledKey(waveKey);
					}}
					className={cn("progress-line-wave", tone)}
				/>
			</span>
			<span className={cn("progress-line-dot", tone)} style={{ left: `${shown}%` }} />
		</div>
	);
}
