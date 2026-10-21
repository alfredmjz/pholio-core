"use client";

import { LedgerField } from "@/components/common/ledger-field";
import { cn } from "@/lib/utils";

interface SurfacePageProps {
	children: React.ReactNode;
	/** Classes for the content column (spacing, max width). */
	className?: string;
}

/**
 * A redesigned page: the drifting plotter lines pinned behind the content, and a centred
 * content column on top. Styles live in src/styles/surfaces.css.
 */
export function SurfacePage({ children, className }: SurfacePageProps) {
	return (
		<div className="surface relative isolate min-h-full w-full">
			<div className="surface-backdrop" aria-hidden>
				<LedgerField className="surface-backdrop-canvas" />
			</div>
			<div
				className={cn(
					"relative z-10 mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10",
					className
				)}
			>
				{children}
			</div>
		</div>
	);
}
