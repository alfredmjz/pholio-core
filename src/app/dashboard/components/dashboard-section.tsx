import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
	id: string;
	title: string;
	/** One short line under the title, e.g. the period the section covers. */
	note?: string;
	action?: { label: string; href: string };
	/** Stretch to the height of the grid cell, giving the extra room to the body. */
	fill?: boolean;
	className?: string;
	children: React.ReactNode;
}

/** A dashboard module on a translucent sheet, with a consistent heading row. */
export function DashboardSection({ id, title, note, action, fill, className, children }: DashboardSectionProps) {
	return (
		<section
			aria-labelledby={id}
			className={cn("dash-sheet dash-sheet-pad", fill && "flex h-full flex-col", className)}
		>
			<div className="flex items-baseline justify-between gap-4">
				<div className="min-w-0">
					<h2 id={id} className="type-h4 text-primary">
						{title}
					</h2>
					{note && <p className="type-body-sm mt-0.5 text-muted-foreground">{note}</p>}
				</div>
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
