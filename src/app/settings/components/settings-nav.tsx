"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Settings, Lock, CreditCard, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface NavItem {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	disabled?: boolean;
	badge?: string;
	keywords?: string[];
}

const navItems: NavItem[] = [
	{
		label: "Profile",
		href: "/settings/profile",
		icon: User,
		keywords: ["name", "full name", "display name", "username", "email", "avatar", "photo", "picture", "edit profile"],
	},
	{
		label: "Security",
		href: "/settings/security",
		icon: Shield,
		keywords: [
			"password",
			"change password",
			"mfa",
			"2fa",
			"multi-factor",
			"authentication",
			"login",
			"sessions",
			"devices",
			"connect",
			"disconnect",
		],
	},
	{
		label: "Preferences",
		href: "/settings/preferences",
		icon: Settings,
		keywords: [
			"theme",
			"dark mode",
			"light mode",
			"notifications",
			"appearance",
			"color",
			"allocations",
			"budget",
			"new month",
			"new month default",
			"currency",
			"language",
			"regional",
		],
	},
	{
		label: "Data & Privacy",
		href: "/settings/data-privacy",
		icon: Lock,
		keywords: ["export data", "delete account", "privacy", "gdpr", "data"],
	},
	{
		label: "Billing",
		href: "/settings/billing",
		icon: CreditCard,
		disabled: true,
		badge: "Soon",
		keywords: ["subscription", "payment", "card", "plan", "upgrade"],
	},
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
 * - Search functionality to filter settings
 */
export function SettingsNav() {
	const pathname = usePathname();
	const [query, setQuery] = React.useState("");

	const filteredItems = React.useMemo(() => {
		if (!query) return navItems;
		const lowerQuery = query.toLowerCase();
		return navItems.filter(
			(item) =>
				item.label.toLowerCase().includes(lowerQuery) ||
				item.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery))
		);
	}, [query]);

	return (
		<nav
			className="hidden lg:block lg:w-[250px] flex-shrink-0 lg:pr-8 sticky top-8 self-start"
			aria-label="Settings navigation"
		>
			{/* Section title */}
			<div className="mb-6">
				<h2 className="text-sm font-semibold text-primary mb-4">Settings</h2>
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-primary" />
					<Input
						placeholder="Search settings..."
						className="pl-8 h-9 text-sm"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
			</div>

			{/* Navigation items */}
			<ul className="space-y-1">
				{filteredItems.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href;

					if (item.disabled) {
						return (
							<li key={item.href}>
								<div
									className={cn(
										"flex items-center gap-3 px-3 py-2 text-sm rounded-md",
										"text-primary opacity-50 cursor-not-allowed"
									)}
								>
									<Icon className="w-4 h-4 flex-shrink-0" />
									<span className="flex-1">{item.label}</span>
									{item.badge && (
										<span className="px-2 py-0.5 text-xs rounded bg-secondary text-primary">{item.badge}</span>
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
										? "bg-accent/50 border-l-primary text-primary font-medium"
										: "text-primary hover:text-primary hover:bg-accent/50"
								)}
							>
								<Icon className="w-4 h-4 flex-shrink-0" />
								<span className="flex-1">{item.label}</span>
							</Link>
						</li>
					);
				})}
				{filteredItems.length === 0 && <li className="px-3 py-2 text-sm text-primary">No results found</li>}
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
		<nav
			className="lg:hidden mb-6 border-b border-border sticky top-0 z-50 bg-background pt-4 -mt-4 pb-0"
			aria-label="Settings navigation"
		>
			<div className="flex overflow-x-auto scrollbar-hide gap-1 pb-px">
				{navItems.map((item) => {
					const isActive = pathname === item.href;

					if (item.disabled) {
						return (
							<div
								key={item.href}
								className={cn(
									"flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap",
									"text-primary opacity-50 cursor-not-allowed"
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
									? "border-primary text-primary font-medium"
									: "border-transparent text-primary hover:text-primary"
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
