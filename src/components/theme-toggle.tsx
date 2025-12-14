"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ThemeToggleProps {
	isCollapsed?: boolean;
}

export function ThemeToggle({ isCollapsed }: ThemeToggleProps) {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className="w-[88px] h-8 bg-secondary/50 rounded-full animate-pulse" />;
	}

	const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

	if (isCollapsed) {
		return (
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="w-8 h-8 rounded-md bg-transparent hover:bg-secondary-hover transition-colors"
						aria-label="Toggle theme"
					>
						<ThemeIcon className="h-4 w-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent side="right" align="center" className="w-auto p-2" sideOffset={10}>
					<div className="flex flex-col gap-1">
						<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Theme</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setTheme("light")}
							className={cn(
								"justify-start gap-2 h-8 px-2 w-full",
								theme === "light" && "bg-accent text-accent-foreground"
							)}
						>
							<Sun className="h-4 w-4" />
							<span>Light</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setTheme("dark")}
							className={cn(
								"justify-start gap-2 h-8 px-2 w-full",
								theme === "dark" && "bg-accent text-accent-foreground"
							)}
						>
							<Moon className="h-4 w-4" />
							<span>Dark</span>
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setTheme("system")}
							className={cn(
								"justify-start gap-2 h-8 px-2 w-full",
								theme === "system" && "bg-accent text-accent-foreground"
							)}
						>
							<Monitor className="h-4 w-4" />
							<span>System</span>
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<div className="flex items-center p-0.5 bg-secondary border border-border rounded-full w-fit">
			<Button
				variant="ghost"
				size="icon"
				type="button"
				onClick={() => setTheme("light")}
				className={cn(
					"relative h-auto w-auto p-1.5 rounded-full text-muted-foreground transition-all duration-200 hover:bg-transparent hover:text-foreground",
					theme === "light" && "bg-background text-foreground shadow-sm ring-1 ring-black/5"
				)}
				aria-label="Light theme"
			>
				<Sun className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				type="button"
				onClick={() => setTheme("dark")}
				className={cn(
					"relative h-auto w-auto p-1.5 rounded-full text-muted-foreground transition-all duration-200 hover:bg-transparent hover:text-foreground",
					theme === "dark" && "bg-background text-foreground shadow-sm ring-1 ring-black/5"
				)}
				aria-label="Dark theme"
			>
				<Moon className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				type="button"
				onClick={() => setTheme("system")}
				className={cn(
					"relative h-auto w-auto p-1.5 rounded-full text-muted-foreground transition-all duration-200 hover:bg-transparent hover:text-foreground",
					theme === "system" && "bg-background text-foreground shadow-sm ring-1 ring-black/5"
				)}
				aria-label="System theme"
			>
				<Monitor className="h-4 w-4" />
			</Button>
		</div>
	);
}
