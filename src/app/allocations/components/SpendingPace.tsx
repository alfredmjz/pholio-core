import { useMemo } from "react";
import { format, getDaysInMonth, isSameMonth, isAfter, isToday } from "date-fns";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseLocalDate } from "@/lib/date-utils";
import type { MonthYear, Transaction } from "@/app/allocations/types";

interface SpendingPaceProps {
	currentMonth: MonthYear;
	transactions: Transaction[];
	totalBudget: number;
	className?: string;
}

export function SpendingPace({ currentMonth, transactions, totalBudget, className }: SpendingPaceProps) {
	const { data, pacePercentage, isFaster } = useMemo(() => {
		const targetMonthDate = new Date(currentMonth.year, currentMonth.month - 1, 1);
		const daysInMonth = getDaysInMonth(targetMonthDate);
		const today = new Date();
		const isCurrentMonth = isSameMonth(targetMonthDate, today);

		// Group transactions by day
		const spendByDay = new Array(daysInMonth).fill(0);

		transactions.forEach((t) => {
			if (t.amount > 0) return; // Skip income/positive adjustments if any, assuming expenses are negative in raw data, or wait:
			// In allocations, typical transactions are usually positive representations of spend or negative?
			// Let's assume absolute amounts for actual spend as it's common.
			// Let's check: Actual spend is usually positive in UI. Let's just sum Math.abs(t.amount) or if expenses are positive, t.amount.
			// Let's just use t.amount but we might want to check if it's income. Let's assume t.amount is positive for expenses.
			// If there's negative, it might be a refund. Let's just add it as is (t.amount).

			const tDate = parseLocalDate(t.transaction_date);
			// only include transactions in the current target month
			if (tDate.getMonth() + 1 === currentMonth.month && tDate.getFullYear() === currentMonth.year) {
				const dayIndex = tDate.getDate() - 1;
				if (dayIndex >= 0 && dayIndex < daysInMonth) {
					spendByDay[dayIndex] += Math.abs(t.amount); // Assuming absolute to be safe for spend
				}
			}
		});

		let cumulativeSpend = 0;
		const chartData = [];
		let currentDayActual = 0;
		let currentDayIdeal = 0;

		for (let i = 0; i < daysInMonth; i++) {
			const dayNum = i + 1;
			const isFuture = isCurrentMonth && dayNum > today.getDate();

			cumulativeSpend += spendByDay[i];
			const idealSpend = (totalBudget / daysInMonth) * dayNum;

			chartData.push({
				day: `Day ${dayNum}`,
				fullDate: new Date(currentMonth.year, currentMonth.month - 1, dayNum).toISOString(),
				actual: isFuture ? null : cumulativeSpend,
				ideal: idealSpend,
			});

			if (!isFuture || (dayNum === daysInMonth && !isCurrentMonth)) {
				currentDayActual = cumulativeSpend;
				currentDayIdeal = idealSpend;
			}
		}

		// Calculate percentage difference
		let percentage = 0;
		if (currentDayIdeal > 0) {
			percentage = Math.round(((currentDayActual - currentDayIdeal) / currentDayIdeal) * 100);
		}

		return {
			data: chartData,
			pacePercentage: percentage,
			isFaster: percentage > 0,
		};
	}, [currentMonth, transactions, totalBudget]);

	const CustomTooltip = ({ active, payload }: any) => {
		if (active && payload && payload.length) {
			const fullDate = payload[0].payload.fullDate;
			const formattedDate = format(new Date(fullDate), "MMM d, yyyy");
			return (
				<div className="flex flex-col items-center">
					<div className="text-sm font-medium text-muted-foreground">{formattedDate}</div>
				</div>
			);
		}
		return null;
	};

	return (
		<Card className={`flex flex-col bg-card border-border text-card-foreground ${className}`}>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-normal text-muted-foreground">Spending Pace</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col flex-1 pb-4">
				<div className="mb-6">
					<div className="flex items-baseline gap-2">
						<span className={`text-3xl font-bold ${isFaster ? "text-error" : "text-success"}`}>
							{pacePercentage > 0 ? "+" : ""}
							{pacePercentage}%
						</span>
						<span className="text-muted-foreground text-sm">vs ideal pace</span>
					</div>
					<p className="text-muted-foreground text-sm mt-1">
						{isFaster ? "You're spending faster than usual." : "You're spending slower than usual."}
					</p>
				</div>

				<div className="flex-1 mt-auto min-h-[150px]">
					<ResponsiveContainer width="100%" height="100%">
						<ComposedChart data={data} margin={{ top: 20, right: 5, left: 5, bottom: 5 }}>
							<defs>
								<linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="hsl(var(--error))" stopOpacity={0.3} />
									<stop offset="95%" stopColor="hsl(var(--error))" stopOpacity={0} />
								</linearGradient>
							</defs>
							<XAxis dataKey="day" axisLine={false} tickLine={false} tick={false} />
							<Tooltip
								content={<CustomTooltip />}
								cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
								isAnimationActive={false}
							/>
							<Line
								type="monotone"
								dataKey="ideal"
								stroke="hsl(var(--primary))"
								strokeWidth={2}
								strokeDasharray="6 6"
								dot={false}
								isAnimationActive={false}
							/>
							<Area
								type="monotone"
								dataKey="actual"
								stroke="hsl(var(--error))"
								strokeWidth={3}
								fillOpacity={1}
								fill="url(#colorActual)"
								dot={false}
								activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--background))", stroke: "hsl(var(--error))" }}
								isAnimationActive={false}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
