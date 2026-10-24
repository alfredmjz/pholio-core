import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInDays, formatShortDate, parseLocalDate } from "@/lib/date-utils";
import { formatCurrency } from "@/app/dashboard/utils";
import type { Transaction } from "../types";
import { SurfaceSection } from "@/components/layout/surface-section";
import { formatDateParts } from "@/lib/format";

function dayLabel(date: string, today: string): string {
	const days = differenceInDays(parseLocalDate(today), parseLocalDate(date));
	if (days === 0) return "Today";
	if (days === 1) return "Yesterday";
	return formatDateParts(parseLocalDate(date), { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(transactions: Transaction[]) {
	const groups: { date: string; items: Transaction[] }[] = [];
	for (const transaction of transactions) {
		const date = transaction.date.slice(0, 10);
		const group = groups[groups.length - 1];
		if (group && group.date === date) group.items.push(transaction);
		else groups.push({ date, items: [transaction] });
	}
	return groups;
}

/** The latest transactions, grouped by day. */
export function RecentActivity({ transactions, today }: { transactions: Transaction[]; today: string }) {
	const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
	const groups = groupByDay(sorted);

	return (
		<SurfaceSection
			id="recent-heading"
			title="Recent activity"
			action={{ label: "All transactions", href: "/allocations" }}
		>
			{groups.length === 0 ? (
				<p className="type-body-sm text-muted-foreground">
					Income, spending and transfers you record will show up here.
				</p>
			) : (
				<div className="gap-x-12 md:columns-2 [&>*+*]:mt-4 md:[&>*+*]:mt-0">
					{groups.map((group) => (
						<div key={group.date} className="break-inside-avoid md:pb-4">
							<h3 className="type-label text-muted-foreground">
								<time dateTime={group.date} title={formatShortDate(group.date)}>
									{dayLabel(group.date, today)}
								</time>
							</h3>
							<ul className="mt-1">
								{group.items.map((transaction) => {
									const isIncome = transaction.type === "income";
									const isTransfer = transaction.type === "transfer";
									return (
										<li
											key={transaction.id}
											className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0"
										>
											<div className="min-w-0">
												<p className="type-body-sm truncate font-medium text-primary">{transaction.description}</p>
												<p className="type-body-xs truncate text-muted-foreground">
													{transaction.category}
													{transaction.account ? `, ${transaction.account}` : ""}
												</p>
											</div>
											<span
												className={cn(
													"type-value flex shrink-0 items-center gap-1.5",
													isIncome ? "text-success" : isTransfer ? "text-muted-foreground" : "text-primary"
												)}
											>
												{isTransfer && <ArrowLeftRight className="h-3.5 w-3.5" aria-label="Transfer" />}
												{isIncome ? "+" : isTransfer ? "" : "−"}
												{formatCurrency(Math.abs(transaction.amount), { showCents: true })}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</div>
			)}
		</SurfaceSection>
	);
}
