import type { ReactNode } from "react";
import { PiggyBank } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContributionCardProps {
	/** Heading, e.g. "RRSP Deduction Limit". */
	title: string;
	/** One line under the heading. */
	description?: string;
	/** Small label on the right, e.g. the plan ("RRSP"). */
	badge?: string;
	icon?: ReactNode;
	children: ReactNode;
	className?: string;
	"data-testid"?: string;
}

/**
 * Shared sheet for contribution-room panels: icon, title, description and an optional badge,
 * with the body passed in. The title and description are set by whoever plugs it in, so each
 * plan can use CRA's own wording.
 */
export function ContributionCard({
	title,
	description,
	badge,
	icon = <PiggyBank className="h-4 w-4" />,
	children,
	className,
	"data-testid": testId,
}: ContributionCardProps) {
	return (
		<section className={cn("surface-sheet surface-sheet-pad", className)} data-testid={testId}>
			<div className="flex flex-col gap-5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-muted text-success">
							{icon}
						</div>
						<div className="min-w-0">
							<h2 className="type-h4 text-primary">{title}</h2>
							{description && <p className="type-body-sm mt-0.5 text-muted-foreground">{description}</p>}
						</div>
					</div>
					{badge && (
						<Badge variant="secondary" className="shrink-0 rounded-full">
							{badge}
						</Badge>
					)}
				</div>
				{children}
			</div>
		</section>
	);
}
