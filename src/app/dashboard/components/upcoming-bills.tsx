import Link from "next/link";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { ServiceLogo } from "@/components/service-logo";
import { UPCOMING_WINDOW_DAYS, type UpcomingBill } from "../heads-up";
import { DashboardSection } from "./dashboard-section";

function whenLabel(daysUntil: number): string {
	if (daysUntil < -1) return `${Math.abs(daysUntil)} days overdue`;
	if (daysUntil === -1) return "1 day overdue";
	if (daysUntil === 0) return "Due today";
	if (daysUntil === 1) return "Tomorrow";
	return `In ${daysUntil} days`;
}

const VISIBLE = 5;

/** Recurring bills and subscriptions due in the next two weeks. */
export function UpcomingBills({ bills }: { bills: UpcomingBill[] }) {
	const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
	const shown = bills.slice(0, VISIBLE);
	const hidden = bills.length - shown.length;

	return (
		<DashboardSection
			id="upcoming-heading"
			title="Coming up"
			note={
				bills.length > 0
					? `${formatCurrency(total, { showCents: true })} due in the next ${UPCOMING_WINDOW_DAYS} days`
					: `Next ${UPCOMING_WINDOW_DAYS} days`
			}
			action={{ label: "Recurring", href: "/recurring" }}
		>
			{bills.length === 0 ? (
				<p className="type-body-sm text-muted-foreground">
					Nothing due in the next two weeks.{" "}
					<Link href="/recurring" className="text-primary underline-offset-4 hover:underline">
						Add a bill or subscription
					</Link>{" "}
					to see it here before it&apos;s due.
				</p>
			) : (
				<ul className="-mx-2">
					{shown.map((bill) => {
						const date = parseLocalDate(bill.dueDate);
						const overdue = bill.daysUntil < 0;
						return (
							<li key={bill.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
								<div
									className={cn(
										"flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 leading-none",
										overdue ? "border-error/40 text-error" : "border-border/80 text-primary"
									)}
									aria-hidden
								>
									<span className="type-caption text-muted-foreground">
										{date.toLocaleDateString("en-US", { month: "short" })}
									</span>
									<span className="type-body-lg mt-0.5 font-semibold tabular-nums">{date.getDate()}</span>
								</div>
								<ServiceLogo
									name={bill.name}
									serviceProvider={bill.serviceProvider}
									className="h-7 w-7 shrink-0"
									width={28}
									height={28}
								/>
								<div className="min-w-0 flex-1">
									<p className="type-body-sm truncate font-medium text-primary">{bill.name}</p>
									<p className={cn("type-body-xs", overdue ? "text-error" : "text-muted-foreground")}>
										{whenLabel(bill.daysUntil)}
									</p>
								</div>
								<span className="type-value shrink-0 text-primary">
									{formatCurrency(bill.amount, { showCents: true })}
								</span>
							</li>
						);
					})}
				</ul>
			)}
			{hidden > 0 && (
				<Link href="/recurring" className="type-body-sm mt-2 inline-block text-muted-foreground hover:text-primary">
					{hidden} more due later
				</Link>
			)}
		</DashboardSection>
	);
}
