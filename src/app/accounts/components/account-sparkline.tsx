import { cn } from "@/lib/utils";
import type { BalancePoint } from "../account-insights";

const WIDTH = 96;
const HEIGHT = 28;

/** A small line of an account's balance over recent weeks. Draws nothing without two points. */
export function AccountSparkline({
	points,
	tone,
	className,
}: {
	points: BalancePoint[];
	tone: "asset" | "liability";
	className?: string;
}) {
	if (points.length < 2) {
		return <span className={cn("type-body-xs text-muted-foreground", className)}>No history yet</span>;
	}

	const values = points.map((p) => p.balance);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const coords = values.map((v, i) => {
		const x = (i / (values.length - 1)) * WIDTH;
		const y = 2 + (1 - (v - min) / span) * (HEIGHT - 4);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	});
	const first = values[0];
	const last = values[values.length - 1];
	const direction = last > first ? "up" : last < first ? "down" : "flat";
	const label = `Balance ${direction === "flat" ? "unchanged" : direction === "up" ? "rose" : "fell"} over the last ${points.length > 2 ? "30 days" : "period"}`;

	return (
		<svg
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			preserveAspectRatio="none"
			className={cn("h-7 w-full max-w-24 overflow-visible", className)}
			role="img"
			aria-label={label}
		>
			<polyline
				points={coords.join(" ")}
				fill="none"
				className={tone === "liability" ? "stroke-error/70" : "stroke-primary/70"}
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
