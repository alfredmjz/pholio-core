"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";
import type { UserProfile } from "@/lib/getUserProfile";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitch } from "@/components/common/theme-switch";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
	userProfile: UserProfile | null;
	onSignOut: () => void;
	isCollapsed: boolean;
	/** "avatar" is just the initials (phone top bar); "row" adds the name and email (sidebar). */
	variant?: "avatar" | "row";
	/** Where the dropdown opens relative to the trigger. Defaults to above, for the sidebar footer. */
	menuSide?: "top" | "right" | "bottom" | "left";
	menuAlign?: "start" | "center" | "end";
}

export function UserProfileMenu({
	userProfile,
	onSignOut,
	isCollapsed,
	variant = "avatar",
	menuSide = "top",
	menuAlign = "start",
}: UserProfileMenuProps) {
	const [open, setOpen] = React.useState(false);

	const displayName = userProfile?.full_name || userProfile?.guest_name || "Pholio User";
	const displayInitials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	// The sidebar row keeps one layout at every width and fades its name when collapsed.
	const isRow = variant === "row";
	const showDetails = isRow && !isCollapsed;

	const handleSignOutClick = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setOpen(false);
			onSignOut();
		},
		[onSignOut]
	);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex max-w-full items-center gap-3 rounded-full text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
						isRow ? "w-full overflow-hidden p-1 pr-3 hover:bg-primary/[0.035]" : "justify-center p-0.5"
					)}
					aria-label={showDetails ? undefined : `Account menu for ${displayName}`}
				>
					{userProfile?.avatar_url ? (
						<img src={userProfile.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
					) : (
						<span
							className="type-body-xs flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
							aria-hidden
						>
							{displayInitials}
						</span>
					)}
					{isRow && (
						<span
							className={cn(
								"flex min-w-0 flex-1 items-center gap-3 transition-opacity duration-150",
								isCollapsed && "opacity-0"
							)}
							aria-hidden={isCollapsed}
						>
							<span className="min-w-0 flex-1">
								<span className="type-body-sm block truncate font-medium text-primary">{displayName}</span>
								{userProfile?.email && (
									<span className="type-body-xs block truncate text-muted-foreground">{userProfile.email}</span>
								)}
							</span>
							<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
						</span>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side={menuSide}
				align={menuAlign}
				sideOffset={8}
				className={cn("w-60 rounded-2xl p-1.5", showDetails && "min-w-[--radix-dropdown-menu-trigger-width]")}
			>
				<div className="px-2 pb-2 pt-1.5">
					<p className="type-body-sm truncate font-medium text-primary">{displayName}</p>
					{userProfile?.email && <p className="type-body-xs truncate text-muted-foreground">{userProfile.email}</p>}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuLabel className="type-body-xs px-2 pb-1.5 pt-2 font-normal text-muted-foreground">
					Appearance
				</DropdownMenuLabel>
				<ThemeSwitch className="mx-1 mb-1.5" />
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/settings/profile" className="w-full cursor-pointer" onClick={() => setOpen(false)}>
						Profile and settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOutClick} className="cursor-pointer">
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
