"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PieChart, Repeat, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarNavigationProps {
	isCollapsed: boolean;
}

/** In the order a month is worked through, not alphabetical: this is navigation, not a picker. */
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/allocations", label: "Allocations", icon: PieChart },
	{ href: "/recurring", label: "Recurring", icon: Repeat },
	{ href: "/accounts", label: "Accounts", icon: Wallet },
];

/** Classes for one sidebar link. */
export function sidebarItemClass(isActive: boolean) {
	return cn(
		// One layout at every width: the icon sits where the collapsed rail centres it and the label
		// fades and is clipped, so resizing the sidebar never jumps.
		"type-body-sm flex h-10 w-full items-center gap-3 overflow-hidden rounded-full px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		isActive
			? "bg-primary/[0.07] font-medium text-primary"
			: "text-muted-foreground hover:bg-primary/[0.035] hover:text-primary"
	);
}

export function isActivePath(pathname: string | null, href: string) {
	return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
}

export function SidebarNavigation({ isCollapsed }: SidebarNavigationProps) {
	const pathname = usePathname();

	return (
		<nav aria-label="Main" className="flex flex-col gap-1 px-3">
			{NAV_ITEMS.map(({ href, label, icon: Icon }) => {
				const isActive = isActivePath(pathname, href);
				return (
					<Link
						key={href}
						href={href}
						className={sidebarItemClass(isActive)}
						aria-current={isActive ? "page" : undefined}
						aria-label={isCollapsed ? label : undefined}
						title={isCollapsed ? label : undefined}
					>
						<Icon className="h-4 w-4 shrink-0" aria-hidden />
						<span
							className={cn("whitespace-nowrap transition-opacity duration-150", isCollapsed && "opacity-0")}
							aria-hidden={isCollapsed}
						>
							{label}
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
