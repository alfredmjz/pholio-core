"use client";

import { ThemeToggle } from "@/components/theme-toggle";

interface SidebarFooterProps {
	isCollapsed: boolean;
}

import { cn } from "@/lib/utils";

export function SidebarFooter({ isCollapsed }: SidebarFooterProps) {
	return (
		<div
			className={cn("py-4 mt-auto border-t border-secondary-border", isCollapsed ? "px-2 flex justify-center" : "px-4")}
		>
			<ThemeToggle isCollapsed={isCollapsed} />
		</div>
	);
}
