import { cn } from "@/lib/utils";

interface SegmentedProgressProps {
	value: number;
	total: number;
	className?: string;
}

export function SegmentedProgress({ value, total, className }: SegmentedProgressProps) {
	return (
		<div className={cn("flex items-center gap-1 w-full", className)}>
			{Array.from({ length: total }).map((_, i) => (
				<div
					key={i}
					className={cn(
						"h-1.5 rounded-full transition-all duration-300 flex-1",
						i < value ? "bg-primary" : "bg-muted/60"
					)}
					style={{
						maxWidth: total <= 4 ? "32px" : total <= 10 ? "16px" : "none",
						minWidth: "2px",
					}}
				/>
			))}
		</div>
	);
}
