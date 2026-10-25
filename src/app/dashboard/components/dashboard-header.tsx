"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { parseLocalDate } from "@/lib/date-utils";
import { formatDateParts } from "@/lib/format";

function greetingFor(hour: number): string {
	if (hour < 5) return "Good evening";
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

interface DashboardHeaderProps {
	today: string;
	firstName: string | null;
	onAddTransaction: () => void;
}

export function DashboardHeader({ today, firstName, onAddTransaction }: DashboardHeaderProps) {
	// The hour is only known in the browser; render a neutral greeting until then to avoid a
	// hydration mismatch.
	const [greeting, setGreeting] = useState("Hello");
	useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);

	const dateLabel = formatDateParts(parseLocalDate(today), {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<header className="flex items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="sr-only">Dashboard</h1>
				<p className="type-body-sm text-muted-foreground">{dateLabel}</p>
				<p className="type-h3 mt-1 text-primary">
					{greeting}
					{firstName ? `, ${firstName}` : ""}
				</p>
			</div>
			<button
				type="button"
				onClick={onAddTransaction}
				className="type-control inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-10 sm:w-auto sm:pl-3.5 sm:pr-4"
			>
				<Plus className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
				<span className="sr-only sm:not-sr-only">Add transaction</span>
			</button>
		</header>
	);
}
