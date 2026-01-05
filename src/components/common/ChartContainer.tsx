"use client";

import { useState, useEffect, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartContainerProps {
	children: ReactNode;
	className?: string;
	height?: number | string;
	width?: number | string;
	minWidth?: number | string;
}

export function ChartContainer({
	children,
	className,
	height = "100%",
	width = "100%",
	minWidth = 0,
}: ChartContainerProps) {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Create a wrapper style object to handle minWidth and height
	const style = {
		minWidth: minWidth,
		height: height,
		width: width,
	};

	if (!isMounted) {
		return <Skeleton className={cn("w-full", className)} style={style} />;
	}

	return (
		<div className={cn("w-full", className)} style={style}>
			<ResponsiveContainer width="100%" height="100%">
				<>{children}</>
			</ResponsiveContainer>
		</div>
	);
}
