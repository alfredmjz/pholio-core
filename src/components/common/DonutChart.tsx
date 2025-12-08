"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface DonutChartData {
	name: string;
	value: number;
	color: string;
}

interface DonutChartProps {
	data: DonutChartData[];
	size?: number; // Radius of the donut
	strokeWidth?: number;
	className?: string;
	centerContent?: React.ReactNode;
	showTooltip?: boolean;
}

export function DonutChart({
	data,
	size = 40,
	strokeWidth = 12,
	className,
	centerContent,
	showTooltip = false,
}: DonutChartProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	const total = useMemo(() => {
		return data.reduce((acc, curr) => acc + curr.value, 0);
	}, [data]);

	// Calculate segments
	const segments = useMemo(() => {
		if (data.length === 0 || total === 0) return [];

		let currentAngle = 0;
		return data.map((item, index) => {
			const percentage = (item.value / total) * 100;
			const angle = (percentage / 100) * 360;
			const startAngle = currentAngle;
			currentAngle += angle;

			return {
				...item,
				percentage,
				startAngle,
				endAngle: currentAngle,
				originalIndex: index,
			};
		});
	}, [data, total]);

	// Helper for SVG parsing
	const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
		const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
		return {
			x: centerX + radius * Math.cos(angleInRadians),
			y: centerY + radius * Math.sin(angleInRadians),
		};
	};

	const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
		const start = polarToCartesian(x, y, radius, endAngle);
		const end = polarToCartesian(x, y, radius, startAngle);
		const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

		return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
	};

	// Center point for SVG (50, 50 to allow scaling via viewBox)
	const CX = 50;
	const CY = 50;
	// Use 40 as base radius to leave room for stroke
	const RADIUS = 40;
	// Scale factor if user wants different sizes, but viewBox keeps it relative

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	return (
		<div className={cn("relative", className)} style={{ width: size * 4, height: size * 4 }}>
			<svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
				{/* Background circle */}
				<circle
					cx={CX}
					cy={CY}
					r={RADIUS}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-muted/20"
				/>

				{/* Data segments */}
				{segments.map((segment, index) => (
					<g key={index}>
						<path
							d={describeArc(CX, CY, RADIUS, segment.startAngle, segment.endAngle - 0.5)} // -0.5 for gap
							fill="none"
							stroke={segment.color}
							strokeWidth={strokeWidth}
							strokeLinecap="round"
							className="transition-all duration-300 cursor-pointer hover:opacity-80"
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
						/>
					</g>
				))}
			</svg>

			{/* Center Content */}
			{centerContent && (
				<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
					{centerContent}
				</div>
			)}

			{/* Tooltip */}
			{showTooltip && hoveredIndex !== null && segments[hoveredIndex] && (
				<div
					className="absolute bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs z-50 whitespace-nowrap pointer-events-none border border-border"
					style={{
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)", // Centered tooltip for donut usually looks best or follow mouse
					}}
				>
					<div className="font-semibold">{segments[hoveredIndex].name}</div>
					<div>{formatCurrency(segments[hoveredIndex].value)}</div>
					<div className="text-muted-foreground text-[10px]">{segments[hoveredIndex].percentage.toFixed(1)}%</div>
				</div>
			)}
		</div>
	);
}
