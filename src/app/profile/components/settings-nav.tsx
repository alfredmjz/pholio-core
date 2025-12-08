"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Settings, Lock, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	disabled?: boolean;
	badge?: string;
}

const navItems: NavItem[] = [
	{ label: "Profile", href: "/profile", icon: User },
	{ label: "Security", href: "/profile/security", icon: Shield },
	{ label: "Preferences", href: "/profile/preferences", icon: Settings },
	{ label: "Data & Privacy", href: "/profile/data-privacy", icon: Lock },
	{ label: "Billing", href: "/profile/billing", icon: CreditCard, disabled: true, badge: "Soon" },
];

/**
 * Desktop Settings Navigation
 *
 * Integrated vertical menu visible on screens ≥1024px (lg breakpoint)
 * Clean, minimal design matching Claude.ai settings style
 *
 * Features:
 * - 200px fixed width with right padding for spacing
 * - Subtle hover and active states (no heavy borders)
 * - 2px left accent on active item
 * - Smooth transitions (200ms)
 */
export function SettingsNav() {
	const pathname = usePathname();

	return (
		<nav className="hidden lg:block lg:w-[200px] flex-shrink-0 lg:pr-8" aria-label="Settings navigation">
			{/* Section title */}
			<div className="mb-6">
				<h2 className="text-sm font-semibold text-foreground">Settings</h2>
			</div>

			{/* Navigation items */}
			<ul className="space-y-1">
				{navItems.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href;

					if (item.disabled) {
						return (
							<li key={item.href}>
								<div
									className={cn(
										"flex items-center gap-3 px-3 py-2 text-sm rounded-md",
										"text-muted-foreground opacity-50 cursor-not-allowed"
									)}
								>
									<Icon className="w-4 h-4 flex-shrink-0" />
									<span className="flex-1">{item.label}</span>
									{item.badge && (
										<span className="px-2 py-0.5 text-xs rounded bg-secondary text-muted-foreground">{item.badge}</span>
									)}
								</div>
							</li>
						);
					}

					return (
						<li key={item.href}>
							<Link
								href={item.href}
								aria-current={isActive ? "page" : undefined}
								className={cn(
									"flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200",
									"border-l-2 border-transparent",
									isActive
										? "bg-accent/50 border-l-primary text-foreground font-medium"
										: "text-muted-foreground hover:text-foreground hover:bg-accent/50"
								)}
							>
								<Icon className="w-4 h-4 flex-shrink-0" />
								<span className="flex-1">{item.label}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/**
 * Mobile & Tablet Settings Navigation
 *
 * Horizontal scrollable tabs visible on screens <1024px
 * Replaces dropdown with more discoverable tab pattern
 *
 * Features:
 * - Horizontal scroll for overflow tabs
 * - Bottom border indicator for active tab
 * - Touch-friendly 44px height
 * - Smooth transitions
 */
export function SettingsNavMobile() {
	const pathname = usePathname();

	return (
		<nav className="lg:hidden mb-6 border-b border-border" aria-label="Settings navigation">
			<div className="flex overflow-x-auto scrollbar-hide gap-1 pb-px">
				{navItems.map((item) => {
					const isActive = pathname === item.href;

					if (item.disabled) {
						return (
							<div
								key={item.href}
								className={cn(
									"flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap",
									"text-muted-foreground opacity-50 cursor-not-allowed"
								)}
							>
								<span>{item.label}</span>
								{item.badge && <span className="px-2 py-0.5 text-xs rounded bg-secondary">{item.badge}</span>}
							</div>
						);
					}

					return (
						<Link
							key={item.href}
							href={item.href}
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors",
								"border-b-2",
								isActive
									? "border-primary text-foreground font-medium"
									: "border-transparent text-muted-foreground hover:text-foreground"
							)}
						>
							{item.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
