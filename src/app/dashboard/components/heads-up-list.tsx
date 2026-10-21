import Link from "next/link";
import { CalendarX2, Gift, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeadsUpItem, HeadsUpKind } from "../heads-up";

const KIND_STYLE: Record<HeadsUpKind, { icon: typeof Gift; tone: string; label: string }> = {
	overdue_bill: { icon: CalendarX2, tone: "text-error bg-error-muted", label: "Overdue bill" },
	over_budget: { icon: PieChart, tone: "text-error bg-error-muted", label: "Over budget" },
	promotion: { icon: Gift, tone: "text-accent bg-accent-muted", label: "Promotion deadline" },
};

/** Up to three things worth acting on. Renders nothing when all is well. */
export function HeadsUpList({ items }: { items: HeadsUpItem[] }) {
	if (items.length === 0) return null;

	return (
		<section aria-labelledby="heads-up-heading">
			<h2 id="heads-up-heading" className="sr-only">
				Heads up
			</h2>
			<ul className={cn("grid gap-3", items.length > 1 && "md:grid-cols-2", items.length > 2 && "xl:grid-cols-3")}>
				{items.map((item) => {
					const style = KIND_STYLE[item.kind];
					const Icon = style.icon;
					return (
						<li key={item.id} className="min-w-0">
							<Link
								href={item.href}
								className="surface-sheet card-interactive flex h-full items-start gap-3 rounded-2xl px-4 py-3.5"
							>
								<span
									className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", style.tone)}
									title={style.label}
								>
									<Icon className="h-4 w-4" aria-hidden />
									<span className="sr-only">{style.label}</span>
								</span>
								<span className="min-w-0">
									<span className="type-body-sm block font-medium text-primary">{item.title}</span>
									<span className="type-body-xs mt-0.5 block text-muted-foreground">{item.detail}</span>
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
