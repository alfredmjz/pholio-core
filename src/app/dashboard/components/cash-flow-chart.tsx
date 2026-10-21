"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import type { CashflowMonth } from "../cashflow";
import { DashboardSection } from "./dashboard-section";

/** Smallest chart height; the chart grows to fill its grid cell on desktop. */
const MIN_CHART_HEIGHT = 168;

/**
 * Income rises above the line, spending hangs below it, one column per month. Selecting a month
 * (hover, tap or keyboard) shows its numbers; the current month is selected by default.
 */
export function CashFlowChart({ months }: { months: CashflowMonth[] }) {
	const [selected, setSelected] = useState(months.length - 1);
	const month = months[selected];

	const peak = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses]));
	const totalNet = months.reduce((sum, m) => sum + m.net, 0);
	const hasData = months.some((m) => m.income > 0 || m.expenses > 0);

	const summary = !hasData
		? "No income or spending recorded in the last six months."
		: totalNet >= 0
			? `You kept ${formatCurrency(totalNet)} over ${months.length} months.`
			: `You spent ${formatCurrency(Math.abs(totalNet))} more than you earned over ${months.length} months.`;

	return (
		<DashboardSection id="cashflow-heading" title="Cash flow" note={summary} fill>
			<div className="flex flex-1 gap-1 sm:gap-2" role="radiogroup" aria-label="Month">
				{months.map((m, index) => {
					// Each bar can use half the chart (minus a little headroom) at the peak month.
					const incomeHeight = `calc((50% - 6px) * ${m.income / peak})`;
					const expenseHeight = `calc((50% - 6px) * ${m.expenses / peak})`;
					const isSelected = index === selected;
					const isCurrent = index === months.length - 1;
					return (
						<button
							key={m.key}
							type="button"
							role="radio"
							aria-checked={isSelected}
							aria-label={`${m.label}: ${formatCurrency(m.income)} in, ${formatCurrency(m.expenses)} out`}
							onMouseEnter={() => setSelected(index)}
							onFocus={() => setSelected(index)}
							onClick={() => setSelected(index)}
							className={cn(
								"group flex min-w-0 flex-1 flex-col items-center rounded-xl pt-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isSelected ? "bg-primary/[0.045]" : "hover:bg-primary/[0.03]"
							)}
						>
							<span className="relative block w-full flex-1" style={{ minHeight: MIN_CHART_HEIGHT }} aria-hidden>
								<span
									className={cn(
										"absolute bottom-1/2 left-1/2 w-[38%] max-w-7 -translate-x-1/2 rounded-t-md bg-accent transition-opacity",
										!isSelected && "opacity-70"
									)}
									style={{ height: incomeHeight }}
								/>
								<span
									className={cn(
										"absolute left-1/2 top-1/2 w-[38%] max-w-7 -translate-x-1/2 rounded-b-md bg-primary/25 transition-opacity",
										isCurrent &&
											"bg-[repeating-linear-gradient(135deg,hsl(var(--primary)/0.3)_0_3px,hsl(var(--primary)/0.14)_3px_6px)]",
										!isSelected && "opacity-70"
									)}
									style={{ height: expenseHeight }}
								/>
								<span className="absolute inset-x-0 top-1/2 h-px bg-border" />
							</span>
							<span className={cn("type-caption pb-2 pt-1.5", isSelected ? "text-primary" : "text-muted-foreground")}>
								{m.label}
							</span>
						</button>
					);
				})}
			</div>

			<dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/70 pt-4">
				<div>
					<dt className="type-body-xs flex items-center gap-1.5 text-muted-foreground">
						<span className="h-2 w-2 rounded-sm bg-accent" aria-hidden />
						In
					</dt>
					<dd className="type-value mt-1 text-primary">{formatCurrency(month.income)}</dd>
				</div>
				<div>
					<dt className="type-body-xs flex items-center gap-1.5 text-muted-foreground">
						<span className="h-2 w-2 rounded-sm bg-primary/25" aria-hidden />
						Out
					</dt>
					<dd className="type-value mt-1 text-primary">{formatCurrency(month.expenses)}</dd>
				</div>
				<div>
					<dt className="type-body-xs text-muted-foreground">
						{month.label}
						{selected === months.length - 1 ? " so far" : ""}
					</dt>
					<dd className={cn("type-value mt-1", month.net >= 0 ? "text-success" : "text-error")}>
						{formatCurrency(month.net, { showSign: true })}
					</dd>
				</div>
			</dl>
		</DashboardSection>
	);
}
