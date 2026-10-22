import Link from "next/link";
import { cn } from "@/lib/utils";

interface SurfaceSectionProps {
	id: string;
	title: string;
	/** One short line under the title, e.g. the period the section covers. */
	note?: string;
	action?: { label: string; href: string };
	/** Buttons for the heading row, used instead of `action` when the section needs controls. */
	headerActions?: React.ReactNode;
	/** Stretch to the height of the grid cell, giving the extra room to the body. */
	fill?: boolean;
	className?: string;
	children: React.ReactNode;
}

/** A page module on a translucent sheet, with a consistent heading row. */
export function SurfaceSection({
	id,
	title,
	note,
	action,
	headerActions,
	fill,
	className,
	children,
}: SurfaceSectionProps) {
	return (
		<section
			aria-labelledby={id}
			className={cn("surface-sheet surface-sheet-pad", fill && "flex h-full flex-col", className)}
		>
			{/* Wraps rather than squeezing: the title keeps room to read, and actions drop below it
			    when a narrow column can't fit both on one line. */}
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<div className="min-w-[min(100%,11rem)] flex-1">
					<h2 id={id} className="type-h4 text-primary">
						{title}
					</h2>
					{note && <p className="type-body-sm mt-0.5 text-muted-foreground">{note}</p>}
				</div>
				{headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
				{action && (
					<Link
						href={action.href}
						className="type-body-sm shrink-0 rounded-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{action.label}
					</Link>
				)}
			</div>
			<div className={cn("mt-5", fill && "flex flex-1 flex-col")}>{children}</div>
		</section>
	);
}
