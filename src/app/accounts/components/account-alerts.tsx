import Link from "next/link";
import { CalendarClock, Gauge, Gift, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountAlert, AccountAlertKind } from "../account-insights";

const KIND_STYLE: Record<AccountAlertKind, { icon: typeof Gift; tone: string; label: string }> = {
	payment_due: { icon: CalendarClock, tone: "bg-warning-muted text-warning", label: "Payment due" },
	high_utilization: { icon: Gauge, tone: "bg-warning-muted text-warning", label: "High credit use" },
	promotion: { icon: Gift, tone: "bg-accent-muted text-accent", label: "Promotion deadline" },
	goal_reached: { icon: Trophy, tone: "bg-success-muted text-success", label: "Goal reached" },
};

/** Account-specific things to act on, styled like the Dashboard's heads-up. Hidden when empty. */
export function AccountAlerts({ alerts }: { alerts: AccountAlert[] }) {
	if (alerts.length === 0) return null;

	return (
		<section aria-labelledby="account-alerts-heading">
			<h2 id="account-alerts-heading" className="sr-only">
				Heads up
			</h2>
			<ul className={cn("grid gap-3", alerts.length > 1 && "md:grid-cols-2", alerts.length > 2 && "xl:grid-cols-3")}>
				{alerts.map((alert) => {
					const style = KIND_STYLE[alert.kind];
					const Icon = style.icon;
					return (
						<li key={alert.id} className="min-w-0">
							<Link
								href={alert.href}
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
									<span className="type-body-sm block font-medium text-primary">{alert.title}</span>
									<span className="type-body-xs mt-0.5 block text-muted-foreground">{alert.detail}</span>
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
