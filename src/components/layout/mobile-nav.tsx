"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PieChart, Repeat, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/allocations", label: "Allocations", icon: PieChart },
	{ href: "/recurring", label: "Recurring", icon: Repeat },
	{ href: "/accounts", label: "Accounts", icon: Wallet },
] as const;

/**
 * Primary navigation for phones.
 *
 * Deliberately neutral: navigation uses ink, not the financial green/red, so those
 * colours keep meaning "money in / money out". The active destination is marked by a
 * short ink rule above the icon — the one distinctive move in the mobile chrome.
 */
export function MobileNav() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background lg:hidden"
			style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
		>
			<ul className="grid grid-cols-4">
				{ITEMS.map(({ href, label, icon: Icon }) => {
					const active = pathname === href || pathname.startsWith(`${href}/`);
					return (
						<li key={href}>
							<Link
								href={href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"relative flex min-h-14 flex-col items-center justify-center gap-1 pb-2 pt-2.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
									active ? "text-primary" : "text-primary/55"
								)}
							>
								<span
									aria-hidden
									className={cn(
										"absolute top-0 h-0.5 w-6 rounded-full bg-primary transition-opacity motion-reduce:transition-none",
										active ? "opacity-100" : "opacity-0"
									)}
								/>
								<Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
								<span className="whitespace-nowrap">{label}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
