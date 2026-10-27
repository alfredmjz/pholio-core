"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoTipProps {
	/** Names the button for screen readers, e.g. "How Adaptive works". */
	label: string;
	children: React.ReactNode;
	className?: string;
}

/** A small "i" that opens a short explanation. A popover, so it opens with a tap as well as a click. */
export function InfoTip({ label, children, className }: InfoTipProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={label}
					className={cn(
						"inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						className
					)}
				>
					<Info className="h-3.5 w-3.5" aria-hidden />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				collisionPadding={16}
				className="type-body-sm w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4 text-muted-foreground"
			>
				{children}
			</PopoverContent>
		</Popover>
	);
}
