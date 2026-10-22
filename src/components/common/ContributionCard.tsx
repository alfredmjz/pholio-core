import type { ReactNode } from "react";
import { PiggyBank } from "lucide-react";
import { Card } from "@/components/ui/card";
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
 * Shared shell for contribution-room cards: icon, title, description and an optional badge,
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
		<Card className={cn("p-5", className)} data-testid={testId}>
			<div className="flex flex-col gap-4">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2.5">
						<div className="rounded-lg bg-success-muted p-2 text-success">{icon}</div>
						<div className="min-w-0">
							<h3 className="type-label">{title}</h3>
							{description && <p className="type-caption text-muted-foreground">{description}</p>}
						</div>
					</div>
					{badge && (
						<Badge variant="secondary" className="shrink-0">
							{badge}
						</Badge>
					)}
				</div>
				{children}
			</div>
		</Card>
	);
}
