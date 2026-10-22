"use client";

import { cn } from "@/lib/utils";
import { ProgressLine } from "@/components/ui/progress-line";

interface StepIndicatorProps {
	steps: string[];
	/** Zero-based index of the step being shown. */
	current: number;
	/** Called with a finished step's index, to go back to it. */
	onStepClick?: (index: number) => void;
	className?: string;
}

/**
 * Where a multi-step dialog is: "Step 2 of 3" over one continuous progress line that fills a
 * share per step reached. Each step owns an equal stretch of the line; a finished step's
 * stretch can be clicked to go back to it.
 */
export function StepIndicator({ steps, current, onStepClick, className }: StepIndicatorProps) {
	const reached = ((current + 1) / steps.length) * 100;
	return (
		<nav aria-label="Steps" className={cn("flex flex-col gap-2", className)}>
			<p className="type-body-xs text-muted-foreground">
				Step {current + 1} of {steps.length}
			</p>
			<div className="relative">
				<ProgressLine value={reached} tone="bg-primary" />
				{/* Click targets over the line (taller than it, for fingers), one per step; they add no gaps. */}
				<ol className="absolute inset-x-0 -inset-y-2 flex">
					{steps.map((label, index) => {
						const done = index < current;
						const canGoBack = done && !!onStepClick;
						return (
							<li key={label} className="flex-1">
								<button
									type="button"
									onClick={canGoBack ? () => onStepClick(index) : undefined}
									disabled={!canGoBack}
									aria-current={index === current ? "step" : undefined}
									aria-label={`${label}${done ? ", done" : index === current ? ", current step" : ""}`}
									className={cn(
										"block h-full w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										canGoBack ? "cursor-pointer" : "cursor-default"
									)}
								/>
							</li>
						);
					})}
				</ol>
			</div>
		</nav>
	);
}
