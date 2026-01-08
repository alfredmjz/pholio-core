import { cn } from "@/lib/utils";

interface SegmentedProgressProps {
	value: number;
	total: number;
	className?: string;
}

export function SegmentedProgress({ value, total, className }: SegmentedProgressProps) {
	return (
		<div className={cn("flex items-center gap-1", className)}>
			{Array.from({ length: total }).map((_, i) => (
				<div
					key={i}
					className={cn(
						"h-1.5 rounded-full transition-all duration-300",
						total <= 4 ? "w-8" : "w-4",
						i < value ? "bg-primary" : "bg-muted/60"
					)}
				/>
			))}
		</div>
	);
}
