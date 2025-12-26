"use client";

import * as React from "react";
import { LayoutDashboard, PieChart, Repeat, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import Link from "next/link";

interface SidebarNavigationProps {
	isCollapsed: boolean;
}

export function SidebarNavigation({ isCollapsed }: SidebarNavigationProps) {
	return (
		<div className="flex flex-col gap-2 w-full px-2">
			<Link
				href="/dashboard"
				className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
			>
				<LayoutDashboard className="w-4 h-4 flex-shrink-0" />
				{!isCollapsed && <span>Dashboard</span>}
			</Link>

			<Link
				href="/allocations"
				className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
			>
				<PieChart className="w-4 h-4 flex-shrink-0" />
				{!isCollapsed && <span>Allocations</span>}
			</Link>

			<Link
				href="/recurring"
				className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
			>
				<Repeat className="w-4 h-4 flex-shrink-0" />
				{!isCollapsed && <span>Recurring</span>}
			</Link>

			<Link
				href="/balancesheet"
				className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
			>
				<ScrollText className="w-4 h-4 flex-shrink-0" />
				{!isCollapsed && <span>Balance Sheet</span>}
			</Link>
		</div>
	);
}
