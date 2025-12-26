"use client";

import { useState, useMemo } from "react";
import { LayoutDashboard, PieChart, Repeat, ScrollText } from "lucide-react";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SidebarNavigationProps {
	isCollapsed: boolean;
}

export function SidebarNavigation({ isCollapsed }: SidebarNavigationProps) {
	return (
		<NavigationMenuItem value="navigation-links" className="flex flex-col gap-2 w-full">
			<NavigationMenuLink asChild>
				<Link
					href="/dashboard"
					className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
				>
					<LayoutDashboard className="w-4 h-4 flex-shrink-0" />
					{!isCollapsed && <span>Dashboard</span>}
				</Link>
			</NavigationMenuLink>

			<NavigationMenuLink asChild>
				<Link
					href="/allocations"
					className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
				>
					<PieChart className="w-4 h-4 flex-shrink-0" />
					{!isCollapsed && <span>Allocations</span>}
				</Link>
			</NavigationMenuLink>

			<NavigationMenuLink asChild>
				<Link
					href="/recurring"
					className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
				>
					<Repeat className="w-4 h-4 flex-shrink-0" />
					{!isCollapsed && <span>Recurring</span>}
				</Link>
			</NavigationMenuLink>

			<NavigationMenuLink asChild>
				<Link
					href="/balancesheet"
					className={cn(navigationMenuTriggerStyle(), "w-full", isCollapsed ? "justify-center px-2" : "justify-start")}
				>
					<ScrollText className="w-4 h-4 flex-shrink-0" />
					{!isCollapsed && <span>Balance Sheet</span>}
				</Link>
			</NavigationMenuLink>
		</NavigationMenuItem>
	);
}
