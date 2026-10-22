"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Light, Dark, Auto: the fixed order people expect, not alphabetical. */
const OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: LucideIcon }[] = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "Auto", icon: Monitor },
];

/**
 * A three-way theme switch with a thumb that slides to the chosen option. Arrow keys move
 * between options, like any radio group.
 */
export function ThemeSwitch({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	const current = mounted
		? Math.max(
				0,
				OPTIONS.findIndex((option) => option.value === theme)
			)
		: 0;

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
		if (!step) return;
		event.preventDefault();
		event.stopPropagation();
		const next = (current + step + OPTIONS.length) % OPTIONS.length;
		setTheme(OPTIONS[next].value);
		event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
	};

	return (
		<div
			role="radiogroup"
			aria-label="Theme"
			onKeyDown={handleKeyDown}
			className={cn("relative grid grid-cols-3 rounded-full bg-primary/[0.06] p-1", className)}
		>
			<span
				className={cn(
					"absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-card shadow-card ring-1 ring-border/70 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
					!mounted && "opacity-0"
				)}
				style={{ transform: `translateX(${current * 100}%)` }}
				aria-hidden
			/>
			{OPTIONS.map(({ value, label, icon: Icon }, index) => {
				const checked = mounted && index === current;
				return (
					<button
						key={value}
						type="button"
						role="radio"
						aria-checked={checked}
						tabIndex={checked ? 0 : -1}
						onClick={() => setTheme(value)}
						className={cn(
							"type-body-xs relative z-10 flex h-8 items-center justify-center gap-1.5 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							checked ? "text-primary" : "text-muted-foreground hover:text-primary"
						)}
					>
						<Icon className="h-3.5 w-3.5" aria-hidden />
						{label}
					</button>
				);
			})}
		</div>
	);
}
