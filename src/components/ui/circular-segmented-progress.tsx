"use client";

import { cn } from "@/lib/utils";

interface CircularSegmentedProgressProps {
	total: number;
	current: number;
	size?: number;
	className?: string;
}

export function CircularSegmentedProgress({ total, current, size = 24, className }: CircularSegmentedProgressProps) {
	// Radius = 15.9155 creates a circumference of 100 for easy percentage calc
	const center = 18;
	const radius = 15.9155;
	const strokeWidth = 5;

	const circumference = 100;
	// Increase gap slightly for visibility
	const gap = total > 1 ? 4 : 0;
	const segmentLength = (circumference - gap * total) / total;

	const gapAngle = (gap / 100) * 360;
	const rotationOffset = gapAngle / 2;

	const segments = Array.from({ length: total }).map((_, i) => {
		const isCompleted = i < current;
		// Rotate each segment
		// Start at -90 (12 o'clock) + offset to center the gap
		const rotation = -90 + (360 / total) * i + rotationOffset;

		return (
			<circle
				key={i}
				cx={center}
				cy={center}
				r={radius}
				fill="transparent"
				stroke={isCompleted ? "#22c55e" : "currentColor"}
				strokeWidth={strokeWidth}
				strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
				strokeDashoffset={0}
				transform={`rotate(${rotation} ${center} ${center})`}
				className={cn("transition-all duration-300", isCompleted ? "text-green-500" : "text-muted-foreground/20")}
			/>
		);
	});

	return (
		<div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
			<svg viewBox="0 0 36 36" className="w-full h-full overflow-visible">
				{segments}
			</svg>
		</div>
	);
}
