"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className="w-[88px] h-8 bg-secondary/50 rounded-full animate-pulse" />;
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
